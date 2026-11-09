import logging
from typing import List, Optional
from fastapi import HTTPException, status
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.schemas.invoice import ExtractedInvoiceResponse

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-3.5-flash"

# Lista ordenada de modelos para fallback automático em caso de 503 (alta demanda) ou 404
FALLBACK_CANDIDATE_MODELS: List[str] = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.8-flash",
]

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
    Implements automatic multi-model fallback cascade in case of 503 high-demand or 404 model retirement.
    """
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo PDF vazio fornecido para extração.",
        )

    primary_model = model_name or getattr(settings, "GEMINI_MODEL", None) or DEFAULT_GEMINI_MODEL

    # Monta a esteira ordenada de modelos sem duplicações
    models_to_try: List[str] = [primary_model]
    for candidate in FALLBACK_CANDIDATE_MODELS:
        if candidate not in models_to_try:
            models_to_try.append(candidate)

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

    response = None
    last_error: Optional[Exception] = None

    for attempt_model in models_to_try:
        try:
            logger.info(f"Tentando extração de fatura via Gemini com o modelo: {attempt_model}")
            response = await genai_client.aio.models.generate_content(
                model=attempt_model,
                contents=[pdf_part, EXTRACTION_PROMPT],
                config=config,
            )
            # Se a resposta foi gerada com sucesso, interrompe a esteira de fallback
            logger.info(f"Extração bem-sucedida utilizando o modelo: {attempt_model}")
            break
        except APIError as e:
            err_code = getattr(e, "code", None)
            err_str = str(e).lower()
            last_error = e
            logger.warning(
                f"Modelo '{attempt_model}' falhou com APIError (código {err_code}): {e}. "
                f"Avaliando fallback para próximo modelo da esteira..."
            )

            # Fallback automático para 503 (alta demanda), 404 (modelo descontinuado) ou 429
            if err_code in (503, 404, 429) or "503" in err_str or "unavailable" in err_str or "high demand" in err_str or "404" in err_str:
                continue

            # Para outros erros que não são de capacidade/disponibilidade do modelo, interrompe
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erro retornado pela API do Gemini ({attempt_model}): {e}",
            )
        except Exception as e:
            last_error = e
            logger.warning(f"Erro inesperado no modelo '{attempt_model}': {e}. Tentando fallback...")
            continue

    if response is None:
        logger.error(f"Todos os modelos da esteira de fallback falharam. Último erro: {last_error}")
        err_code = getattr(last_error, "code", None) if last_error else None
        err_str = str(last_error).lower() if last_error else ""
        if err_code == 429 or "429" in err_str or "quota" in err_str or "resource_exhausted" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Cota de requisições do Gemini excedida ou rate limit atingido (429): {last_error}",
            )
        if err_code == 503 or "503" in err_str or "unavailable" in err_str or "high demand" in err_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Serviço Gemini temporariamente indisponível por alta demanda (503). Por favor, aguarde alguns segundos e tente novamente.",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha de comunicação com a API do Gemini após tentar múltiplos modelos ({', '.join(models_to_try)}): {last_error}",
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
