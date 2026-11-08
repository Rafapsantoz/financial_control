import logging
from typing import Optional
from fastapi import HTTPException, status
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.schemas.invoice import ExtractedInvoiceResponse

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"

EXTRACTION_SYSTEM_INSTRUCTION = (
    "Você é um especialista contábil e de extração de dados financeiros de alta precisão. "
    "Sua função é analisar arquivos PDF de faturas de cartão de crédito e extrair todas as "
    "compras e parcelas em formato estritamente estruturado."
)

EXTRACTION_PROMPT = """Você é um especialista contábil e de extração de dados financeiros.
Analise o arquivo PDF da fatura do cartão de crédito anexado.

Instruções:
1. Extraia cada compra realizada no período da fatura.
2. Ignore pagamentos de faturas anteriores, estornos duplicados ou linhas de juros/encargos (classifique encargos como Outros se existirem).
3. Detecte compras parceladas observando padrões como '01/03', '2/10', 'Parcela 04 de 06'. Extraia a parcela atual e o total de parcelas.
4. Identifique se a fatura lista cartões adicionais (muitas faturas separam os gastos por nome do portador impresso no cartão adicional: ex: 'Cartão Final 1234 - NOME DA MÃE'). Se houver, popule o campo suggested_owner com o nome do portador!
5. Sugira a categoria mais adequada para cada compra entre: Mercado, Lazer, Farmácia, Restaurante, Assinaturas, Roupas, Transporte, Outros.
6. Extraia o nome do banco ou emissor identificado (ex: Nubank, Inter, Itaú, C6, Bradesco, Santander), o mês/ano de referência da fatura (ex: 2026-11), a data de vencimento (se disponível) e o valor total consolidado da fatura.
"""


def get_gemini_client(api_key: Optional[str] = None) -> genai.Client:
    """
    Initializes and returns the Google GenAI client instance.
    Uses API_KEY from settings (or GEMINI_API_KEY).
    """
    key = api_key or settings.API_KEY or settings.GEMINI_API_KEY
    if not key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chave de API do Gemini não configurada no ambiente (API_KEY / GEMINI_API_KEY).",
        )
    return genai.Client(api_key=key)


async def call_gemini_structured_extraction(
    pdf_bytes: bytes,
    client: Optional[genai.Client] = None,
    model_name: Optional[str] = None,
) -> ExtractedInvoiceResponse:
    """
    Sends PDF bytes to Gemini API using async structured generation.
    Returns validated ExtractedInvoiceResponse.
    Handles network, quota, and parsing errors with HTTP 502/503.
    """
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo PDF vazio fornecido para extração.",
        )

    effective_model = model_name or getattr(settings, "GEMINI_MODEL", None) or DEFAULT_GEMINI_MODEL
    genai_client = client or get_gemini_client()

    pdf_part = types.Part.from_bytes(
        data=pdf_bytes,
        mime_type="application/pdf",
    )

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=ExtractedInvoiceResponse,
        system_instruction=EXTRACTION_SYSTEM_INSTRUCTION,
        temperature=0.1,
    )

    try:
        response = await genai_client.aio.models.generate_content(
            model=effective_model,
            contents=[pdf_part, EXTRACTION_PROMPT],
            config=config,
        )
    except APIError as e:
        logger.error(f"Gemini API Error: {e}")
        err_code = getattr(e, "code", None)
        err_str = str(e).lower()
        if err_code == 429 or "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cota de requisições do Gemini excedida ou rate limit atingido (429): {e}",
            )
        if err_code == 503 or "503" in err_str or "unavailable" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Serviço Gemini temporariamente indisponível (503): {e}",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Erro retornado pela API do Gemini: {e}",
        )
    except Exception as e:
        logger.error(f"Erro inesperado ao chamar API do Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha de comunicação com a API do Gemini: {str(e)}",
        )

    # Parse and validate structured output
    try:
        if hasattr(response, "parsed") and response.parsed is not None:
            if isinstance(response.parsed, ExtractedInvoiceResponse):
                return response.parsed
            if isinstance(response.parsed, dict):
                return ExtractedInvoiceResponse.model_validate(response.parsed)
            return ExtractedInvoiceResponse.model_validate(response.parsed)

        if hasattr(response, "text") and response.text:
            return ExtractedInvoiceResponse.model_validate_json(response.text)

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="A API do Gemini retornou uma resposta sem conteúdo legível.",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao interpretar JSON estruturado do Gemini: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao interpretar resposta estruturada da API Gemini: {str(e)}",
        )
