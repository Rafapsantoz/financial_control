from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.card import Card
from app.schemas.invoice import (
    ExtractedInvoiceResponse,
    InvoiceConfirmRequest,
    InvoiceConfirmResponse,
)
from app.services.gemini_service import (
    confirm_invoice_transactions,
    extract_invoice_from_pdf,
)

router = APIRouter()


@router.post(
    "/extract",
    response_model=ExtractedInvoiceResponse,
    status_code=status.HTTP_200_OK,
    summary="Extrai compras e parcelas de fatura PDF via Gemini",
)
async def extract_invoice(
    file: UploadFile = File(..., description="Arquivo PDF da fatura do cartão de crédito"),
    card_id: Optional[int] = Query(None, description="ID opcional do cartão (via query)"),
    card_id_form: Optional[int] = Form(None, alias="card_id", description="ID opcional do cartão (via form data)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe um arquivo PDF de fatura de cartão de crédito e extrai compras, parcelas,
    emissor e período através do Google Gemini com Structured Outputs.
    Aplica heurísticas familiares (Rafael, Mãe, Irmã), normalização de categorias e
    verificação de duplicidades (RN02).
    """
    effective_card_id = card_id_form if card_id_form is not None else card_id

    # 1. Validate content type and filename extension
    filename = file.filename or ""
    content_type = file.content_type or ""

    is_pdf_content_type = "pdf" in content_type.lower()
    is_pdf_extension = filename.lower().endswith(".pdf")

    if not is_pdf_content_type and not is_pdf_extension:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos no formato PDF são aceitos para extração.",
        )

    # 2. Read bytes into memory
    pdf_bytes = await file.read()
    if not pdf_bytes or len(pdf_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O arquivo PDF enviado está vazio (0 bytes).",
        )

    # 3. Validate PDF magic number
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo inválido ou corrompido: cabeçalho PDF (%PDF-) não identificado.",
        )

    # 4. Validate card existence if provided
    if effective_card_id is not None:
        card = await db.get(Card, effective_card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão com ID {effective_card_id} não existe no sistema.",
            )

    # 5. Extract and enrich
    extracted_data = await extract_invoice_from_pdf(
        db=db,
        pdf_bytes=pdf_bytes,
        card_id=effective_card_id,
    )

    return extracted_data


@router.post(
    "/confirm",
    response_model=InvoiceConfirmResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirma e persiste em lote as transações da fatura no banco SQLite",
)
async def confirm_invoice(
    payload: InvoiceConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Persiste a lista de transações conferidas e aprovadas pelo usuário na tabela
    `transactions_fapp` com validação estrita de integridade referencial.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma transação informada para confirmação.",
        )

    result = await confirm_invoice_transactions(db=db, request=payload)
    return result
