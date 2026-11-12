import logging
from typing import List, Optional, Tuple
from fastapi import HTTPException, status
from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.schemas.invoice import ExtractedInvoiceResponse

logger = logging.getLogger(__name__)

DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"

# Lista ordenada de modelos para fallback automático em caso de 503 (alta demanda) ou 404
FALLBACK_CANDIDATE_MODELS: List[str] = [
    "gemini-3-flash-preview",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
]

EXTRACTION_SYSTEM_INSTRUCTION = (
    "Você é um especialista contábil e de extração de dados financeiros de alta precisão. "
    "Sua função é analisar faturas, comprovantes, fotos, recibos ou planilhas financeiras e extrair todas as "
    "transações, compras, entradas e parcelas em formato estritamente estruturado."
)

EXTRACTION_PROMPT = """Você é um especialista contábil e de extração de dados financeiros de alta precisão.
Analise os arquivos/documentos anexados (PDF de fatura, prints/fotos de comprovantes colados via Ctrl+V ou dados de planilha).

Instruções:
1. Se houver múltiplas imagens ou arquivos (ex: múltiplos prints de comprovantes ou páginas sequenciais de faturas coladas), analise TODAS as imagens e consolide todas as transações em uma única lista em 'items', sem perder nenhum lançamento.
2. Extraia cada transação identificada (data da compra, descrição do item/estabelecimento, valor).
3. Para cada transação, defina o campo 'entry_type':
   - "expense": para despesas, compras no cartão, saídas, boletos, contas pagas, tarifas bancárias.
   - "income": para receitas, salários, PIX recebidos, pagamentos de clientes, depósitos, estornos creditados.
   Se não for explicitamente uma entrada/receita, classifique como "expense".
4. Ignore pagamentos de faturas anteriores que sejam consolidados ou linhas informativas que dupliquem lançamentos.
5. Detecte compras parceladas observando padrões como '01/03', '2/10', 'Parcela 04 de 06'. Extraia a parcela atual e o total de parcelas.
6. Identifique se a fatura/recibo lista pessoas ou cartões adicionais (ex: 'Cartão Final 1234 - NOME DA MÃE', 'Fulano'). Se houver, popule o campo suggested_owner com o nome da pessoa!
7. Sugira a categoria mais adequada para cada compra entre: Mercado, Lazer, Farmácia, Restaurante, Assinaturas, Roupas, Transporte, Outros.
8. Extraia o nome do banco ou emissor identificado (ex: Nubank, Inter, Itaú, C6, Mercado Pago, PicPay, Bradesco, Santander), o mês/ano de referência (ex: 2026-11), a data de vencimento (se disponível) e o valor total consolidado.
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
    pdf_bytes: Optional[bytes] = None,
    client: Optional[genai.Client] = None,
    model_name: Optional[str] = None,
    mime_type: str = "application/pdf",
    text_content: Optional[str] = None,
    all_files: Optional[List[Tuple[str, bytes, str]]] = None,
) -> ExtractedInvoiceResponse:
    """
    Sends file bytes (PDF, images, multiple pasted screenshots) or spreadsheet text content to Gemini API using async structured generation.
    Returns validated ExtractedInvoiceResponse.
    Implements automatic multi-model fallback cascade in case of 503 high-demand or 404 model retirement.
    """
    if not pdf_bytes and not text_content and not all_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum arquivo ou conteúdo fornecido para extração.",
        )

    primary_model = model_name or getattr(settings, "GEMINI_MODEL", None) or DEFAULT_GEMINI_MODEL

    # Monta a esteira ordenada de modelos sem duplicações
    models_to_try: List[str] = [primary_model]
    for candidate in FALLBACK_CANDIDATE_MODELS:
        if candidate not in models_to_try:
            models_to_try.append(candidate)

    genai_client = client or get_gemini_client()

    contents_payload = []
    if all_files:
        for fname, bdata, mtype in all_files:
            if bdata and mtype:
                contents_payload.append(types.Part.from_bytes(data=bdata, mime_type=mtype))
    elif pdf_bytes:
        file_part = types.Part.from_bytes(
            data=pdf_bytes,
            mime_type=mime_type,
        )
        contents_payload.append(file_part)

    if text_content:
        contents_payload.append(f"--- DADOS DA TABELA/PLANILHA EXTRAÍDA ---\n{text_content}")

    contents_payload.append(EXTRACTION_PROMPT)

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
            logger.info(f"Tentando extração de dados via Gemini ({mime_type}) com o modelo: {attempt_model}")
            response = await genai_client.aio.models.generate_content(
                model=attempt_model,
                contents=contents_payload,
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
