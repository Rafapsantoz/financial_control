import hashlib
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.card import Card
from app.models.invoice_upload import InvoiceUpload
from app.schemas.invoice import (
    ExtractedInvoiceResponse,
    InvoiceConfirmRequest,
    InvoiceConfirmResponse,
    InvoiceUploadResponse,
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
    summary="Extrai compras e parcelas de faturas, fotos ou planilhas via Gemini",
)
async def extract_invoice(
    file: Optional[UploadFile] = File(None, description="Arquivo único (PDF, foto, planilha)"),
    files: Optional[List[UploadFile]] = File(None, description="Múltiplos arquivos ou imagens coladas via Ctrl+V"),
    card_id: Optional[int] = Query(None, description="ID opcional do cartão (via query)"),
    card_id_form: Optional[int] = Form(None, alias="card_id", description="ID opcional do cartão (via form data)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Recebe um ou mais arquivos (PDF de fatura, imagens/prints colados via Ctrl+V ou planilhas)
    e extrai compras, parcelas, emissor e período através do Google Gemini com Structured Outputs.
    Aplica heurísticas familiares (Rafael, Mãe, Irmã), normalização de categorias e
    verificação de duplicidades (RN02).
    """
    effective_card_id = card_id_form if card_id_form is not None else card_id

    # 1. Gather all files sent (supports both single 'file' and multiple 'files' via Ctrl+V)
    all_uploads: List[UploadFile] = []
    if files:
        for f in files:
            if f is not None and f.filename and f not in all_uploads:
                all_uploads.append(f)
    if file is not None and file.filename and file not in all_uploads:
        all_uploads.append(file)

    if not all_uploads:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Apenas arquivos no formato PDF são aceitos para extração (ou imagens PNG/JPG/WEBP e planilhas XLSX/CSV).",
        )

    # 2. Read bytes and validate each uploaded file
    file_records: List[tuple[str, bytes, str]] = []

    for upload in all_uploads:
        fn = upload.filename or ""
        ct = upload.content_type or ""
        lower_fn = fn.lower()
        lower_ct = ct.lower()

        is_pdf = lower_fn.endswith(".pdf") or "pdf" in lower_ct
        is_img = any(lower_fn.endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp", ".heic"]) or "image" in lower_ct
        is_sheet = any(lower_fn.endswith(ext) for ext in [".xlsx", ".xls", ".csv"]) or "sheet" in lower_ct or "csv" in lower_ct

        if not (is_pdf or is_img or is_sheet):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Apenas arquivos no formato PDF são aceitos para extração (ou imagens PNG/JPG/WEBP e planilhas XLSX/CSV).",
            )

        f_bytes = await upload.read()
        if not f_bytes or len(f_bytes) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"O arquivo enviado '{fn}' está vazio (0 bytes).",
            )

        if is_pdf and not f_bytes.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Arquivo inválido ou corrompido: cabeçalho PDF (%PDF-) não identificado.",
            )

        if is_pdf:
            effective_mime = "application/pdf"
        elif lower_fn.endswith(".png"):
            effective_mime = "image/png"
        elif lower_fn.endswith(".jpg") or lower_fn.endswith(".jpeg"):
            effective_mime = "image/jpeg"
        elif lower_fn.endswith(".webp"):
            effective_mime = "image/webp"
        elif lower_fn.endswith(".csv"):
            effective_mime = "text/csv"
        elif lower_fn.endswith(".xlsx"):
            effective_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif lower_fn.endswith(".xls"):
            effective_mime = "application/vnd.ms-excel"
        else:
            effective_mime = ct or "image/png"

        file_records.append((fn, f_bytes, effective_mime))

    # 3. Validate card existence if provided
    if effective_card_id is not None:
        card = await db.get(Card, effective_card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão com ID {effective_card_id} não existe no sistema.",
            )

    # 4. Calculate SHA-256 hash to prevent duplicate file uploads
    file_hash = hashlib.sha256(b"".join(r[1] for r in file_records)).hexdigest()

    # 5. Extract and enrich via Gemini (supports multiple images/prints)
    extracted_data = await extract_invoice_from_pdf(
        db=db,
        pdf_bytes=file_records[0][1],
        card_id=effective_card_id,
        mime_type=file_records[0][2],
        filename=file_records[0][0],
        all_records=file_records,
    )
    extracted_data.file_hash = file_hash

    # 7. Check if this exact file was previously imported and confirmed
    existing_upload = (
        await db.execute(
            select(InvoiceUpload).where(
                InvoiceUpload.file_hash == file_hash,
                InvoiceUpload.status == "CONFIRMED",
            )
        )
    ).scalars().first()

    if existing_upload:
        extracted_data.is_already_imported = True
        formatted_dt = existing_upload.uploaded_at.strftime("%d/%m/%Y às %H:%M")
        extracted_data.already_imported_message = (
            f"Atenção: Este arquivo '{existing_upload.filename}' já foi importado anteriormente "
            f"em {formatted_dt} (Mês: {existing_upload.target_month}, {existing_upload.items_count} compras, "
            f"R$ {existing_upload.total_amount:.2f}). Para evitar cobranças repetidas, verifique se deseja reenviar."
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
    Registra a importação na tabela `invoice_uploads_fapp` para controle de duplicidades.
    """
    if not payload.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhuma transação informada para confirmação.",
        )

    # Calculate or resolve file hash and effective month
    eff_month = payload.target_month or (
        payload.items[0].purchase_date[:7] if payload.items and payload.items[0].purchase_date else "2026-11"
    )
    total_batch_val = round(sum(float(i.value or i.amount or 0.0) for i in payload.items), 2)
    file_hash = payload.file_hash or hashlib.sha256(
        f"{eff_month}_{payload.card_id}_{total_batch_val}".encode()
    ).hexdigest()

    # Check for existing upload record with this file hash
    existing_upload = (
        await db.execute(
            select(InvoiceUpload).where(
                InvoiceUpload.file_hash == file_hash,
                InvoiceUpload.status == "CONFIRMED",
            )
        )
    ).scalars().first()

    if existing_upload and not payload.replace_existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Esta fatura ({existing_upload.filename}) já foi importada anteriormente para o mês "
                f"{existing_upload.target_month}. Para substituir os lançamentos anteriores sem duplicar, "
                f"habilite a opção 'Substituir importação anterior'."
            ),
        )

    # If replace_existing is requested and previous upload exists, wipe previous transactions for this month and card
    if existing_upload and payload.replace_existing:
        from sqlalchemy import delete
        from app.models.transaction import Transaction

        del_stmt = delete(Transaction).where(Transaction.invoice_month == eff_month)
        if payload.card_id:
            del_stmt = del_stmt.where(Transaction.card_id == payload.card_id)
        await db.execute(del_stmt)
        await db.commit()

    result = await confirm_invoice_transactions(db=db, request=payload)

    # Register or update invoice import record
    if existing_upload:
        existing_upload.total_amount = result.total_amount
        existing_upload.items_count = result.confirmed_count
        existing_upload.uploaded_at = datetime.now(timezone.utc)
    else:
        upload_record = InvoiceUpload(
            file_hash=file_hash,
            filename=payload.filename or "fatura_importada.pdf",
            card_id=payload.card_id,
            target_month=payload.target_month or "2026-11",
            bank_or_issuer=payload.bank_or_issuer,
            total_amount=result.total_amount,
            items_count=result.confirmed_count,
            uploaded_at=datetime.now(timezone.utc),
            status="CONFIRMED",
        )
        db.add(upload_record)

    await db.commit()

    return result


@router.get(
    "/uploads",
    response_model=List[InvoiceUploadResponse],
    status_code=status.HTTP_200_OK,
    summary="Histórico de faturas importadas para auditoria e controle de duplicidades",
)
async def list_invoice_uploads(
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna o histórico de todas as faturas em PDF já processadas e confirmadas no sistema.
    """
    res = await db.execute(
        select(InvoiceUpload).order_by(InvoiceUpload.uploaded_at.desc())
    )
    return res.scalars().all()
