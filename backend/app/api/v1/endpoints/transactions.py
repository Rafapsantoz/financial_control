import io
from typing import List, Optional
from datetime import datetime, timezone
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, select

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.owner import Owner
from app.models.card import Card
from app.models.category import Category
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionSplitRequest,
    ReplicateInstallmentsRequest,
)

router = APIRouter()


@router.get("", response_model=List[TransactionResponse], status_code=status.HTTP_200_OK)
async def list_transactions(
    month: Optional[str] = Query(
        None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        description="Filtro de mês no formato YYYY-MM (ex: 2026-11)",
    ),
    card_id: Optional[int] = Query(None, description="Filtrar por ID do cartão"),
    owner_id: Optional[int] = Query(None, description="Filtrar por ID do proprietário"),
    type_id: Optional[int] = Query(None, description="Filtrar por ID da categoria"),
    is_paid: Optional[bool] = Query(None, description="Filtrar por status de pagamento"),
    is_forecast: Optional[bool] = Query(None, description="Filtrar previsões futuras"),
    skip: int = Query(0, ge=0, description="Número de registros a pular"),
    limit: int = Query(100, ge=1, le=1000, description="Limite máximo de registros"),
    db: AsyncSession = Depends(get_db),
):
    """
    List transactions with rich filtering capabilities:
    - `month`: filters transactions where `dt_lcto` falls within the specified YYYY-MM
    - `card_id`, `owner_id`, `type_id`: relational filters
    - `is_paid`, `is_forecast`: status filters
    - `skip`, `limit`: pagination
    """
    query = select(Transaction)

    # Date range filtering for month (supports invoice_month billing cycle or dt_lcto fallback)
    if month:
        year_str, month_str = month.split("-")
        year = int(year_str)
        month_num = int(month_str)
        start_date = datetime(year, month_num, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month_num + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        month_filter = or_(
            Transaction.invoice_month == month,
            and_(
                Transaction.invoice_month.is_(None),
                Transaction.dt_lcto >= start_date,
                Transaction.dt_lcto < end_date,
            ),
        )
        query = query.where(month_filter)

    if card_id is not None:
        query = query.where(Transaction.card_id == card_id)

    if owner_id is not None:
        query = query.where(Transaction.owner_id == owner_id)

    if type_id is not None:
        query = query.where(Transaction.type_id == type_id)

    if is_paid is not None:
        query = query.where(Transaction.is_paid == is_paid)

    if is_forecast is not None:
        query = query.where(Transaction.is_forecast == is_forecast)

    query = query.order_by(Transaction.dt_lcto.desc(), Transaction.id.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_in: TransactionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new transaction with foreign key integrity verification.
    """
    # Foreign Key Validation
    if tx_in.owner_id is not None:
        owner = await db.get(Owner, tx_in.owner_id)
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Proprietário com ID {tx_in.owner_id} não existe.",
            )

    if tx_in.card_id is not None:
        card = await db.get(Card, tx_in.card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão com ID {tx_in.card_id} não existe.",
            )

    if tx_in.type_id is not None:
        category = await db.get(Category, tx_in.type_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Categoria com ID {tx_in.type_id} não existe.",
            )

    tx_dict = tx_in.model_dump()
    if not tx_dict.get("invoice_month") and tx_in.dt_lcto:
        tx_dict["invoice_month"] = tx_in.dt_lcto.strftime("%Y-%m")

    db_tx = Transaction(**tx_dict)
    db.add(db_tx)
    await db.commit()
    await db.refresh(db_tx)
    return db_tx


@router.get(
    "/export",
    status_code=status.HTTP_200_OK,
    summary="Exporta lançamentos e compras para planilha Excel (.xlsx / .xls)",
)
async def export_transactions_excel(
    month: Optional[str] = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="Mês YYYY-MM"),
    card_id: Optional[int] = Query(None, description="Filtrar por cartão"),
    owner_id: Optional[int] = Query(None, description="Filtrar por responsável"),
    type_id: Optional[int] = Query(None, description="Filtrar por categoria"),
    is_paid: Optional[bool] = Query(None, description="Filtrar por status de quitação"),
    is_forecast: Optional[bool] = Query(None, description="Filtrar previsões"),
    search: Optional[str] = Query(None, description="Busca textual na descrição ou comentário"),
    db: AsyncSession = Depends(get_db),
):
    """
    Gera dinamicamente uma planilha Excel (.xlsx / .xls) contendo todas as transações
    filtradas, formatada com estilos profissionais, moedas, status e somatórios.
    """
    query = select(Transaction)

    if month:
        year_str, month_str = month.split("-")
        year = int(year_str)
        month_num = int(month_str)
        start_date = datetime(year, month_num, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month_num + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        month_filter = or_(
            Transaction.invoice_month == month,
            and_(
                Transaction.invoice_month.is_(None),
                Transaction.dt_lcto >= start_date,
                Transaction.dt_lcto < end_date,
            ),
        )
        query = query.where(month_filter)

    if card_id is not None:
        query = query.where(Transaction.card_id == card_id)

    if owner_id is not None:
        query = query.where(Transaction.owner_id == owner_id)

    if type_id is not None:
        query = query.where(Transaction.type_id == type_id)

    if is_paid is not None:
        query = query.where(Transaction.is_paid == is_paid)

    if is_forecast is not None:
        query = query.where(Transaction.is_forecast == is_forecast)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Transaction.description.ilike(term),
                Transaction.comment.ilike(term),
            )
        )

    query = query.order_by(Transaction.dt_lcto.asc(), Transaction.id.asc())
    result = await db.execute(query)
    transactions = result.scalars().all()

    # Pre-fetch maps for fast names
    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o.name for o in owners_res.scalars().all()}

    cats_res = await db.execute(select(Category))
    cats_map = {c.id: c.description for c in cats_res.scalars().all()}

    cards_res = await db.execute(select(Card))
    cards_map = {c.id: c.card_name for c in cards_res.scalars().all()}

    # Create Workbook
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"Fatura {month or 'Geral'}"

    # Header styling
    header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")  # Dark teal
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    headers = [
        "Data",
        "Descrição do Lançamento",
        "Responsável",
        "Categoria",
        "Cartão / Conta",
        "Parcelas",
        "Tipo",
        "Valor (R$)",
        "Status Quitação",
        "Previsão",
        "Mês Cobrança",
        "Observações",
    ]
    ws.append(headers)
    ws.row_dimensions[1].height = 28

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment

    # Data rows styling
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )
    regular_font = Font(name="Segoe UI", size=10)
    bold_font = Font(name="Segoe UI", size=10, bold=True)
    green_font = Font(name="Segoe UI", size=10, color="047857", bold=True)
    red_font = Font(name="Segoe UI", size=10, color="BE123C", bold=True)

    total_expenses = 0.0
    total_incomes = 0.0

    for idx, tx in enumerate(transactions, start=2):
        dt_str = tx.dt_lcto.strftime("%d/%m/%Y") if tx.dt_lcto else ""
        owner_name = owners_map.get(tx.owner_id, "Não atribuído")
        category_name = cats_map.get(tx.type_id, "Outros")
        card_name = cards_map.get(tx.card_id, "Sem Cartão / Direto")
        parcs_str = f"{tx.cur_parcs}/{tx.total_parcs}" if tx.total_parcs > 1 else "À vista"
        entry_type_str = "Receita" if getattr(tx, "entry_type", "expense") == "income" else "Despesa"
        val = round(float(tx.value), 2)
        status_str = "Pago" if tx.is_paid else "Pendente"
        forecast_str = "Previsto" if tx.is_forecast else "Efetivo"
        inv_month_str = tx.invoice_month or ""
        comment_str = tx.comment or ""

        if entry_type_str == "Receita":
            total_incomes += val
        else:
            total_expenses += val

        row_data = [
            dt_str,
            tx.description,
            owner_name,
            category_name,
            card_name,
            parcs_str,
            entry_type_str,
            val,
            status_str,
            forecast_str,
            inv_month_str,
            comment_str,
        ]
        ws.append(row_data)
        ws.row_dimensions[idx].height = 20

        # Style cells in this row
        for col_idx in range(1, len(headers) + 1):
            c = ws.cell(row=idx, column=col_idx)
            c.border = thin_border
            c.font = regular_font

            if col_idx in (1, 6, 11):
                c.alignment = Alignment(horizontal="center")
            elif col_idx == 8:
                c.number_format = '"R$" #,##0.00'
                c.alignment = Alignment(horizontal="right")
                if entry_type_str == "Receita":
                    c.font = green_font
                else:
                    c.font = bold_font
            elif col_idx == 9:
                c.alignment = Alignment(horizontal="center")
                c.font = green_font if tx.is_paid else red_font

    # Summary rows at bottom
    last_row = len(transactions) + 1
    total_row_idx = last_row + 1
    ws.cell(row=total_row_idx, column=2, value="TOTAL DESPESAS:").font = bold_font
    c_tot = ws.cell(row=total_row_idx, column=8, value=total_expenses)
    c_tot.font = bold_font
    c_tot.number_format = '"R$" #,##0.00'
    c_tot.alignment = Alignment(horizontal="right")

    if total_incomes > 0:
        inc_row_idx = total_row_idx + 1
        ws.cell(row=inc_row_idx, column=2, value="TOTAL RECEITAS:").font = green_font
        c_inc = ws.cell(row=inc_row_idx, column=8, value=total_incomes)
        c_inc.font = green_font
        c_inc.number_format = '"R$" #,##0.00'
        c_inc.alignment = Alignment(horizontal="right")

    # Auto-adjust column widths
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

    # Save to memory stream
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"fatura_{month or 'geral'}.xlsx"
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/{id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def get_transaction(id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a single transaction by ID."""
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )
    return tx


@router.put("/{id}", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def update_transaction(
    id: int,
    tx_in: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update fields of an existing transaction with foreign key validation."""
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )

    # Validate updated foreign keys if modified
    if tx_in.owner_id is not None and tx_in.owner_id != tx.owner_id:
        owner = await db.get(Owner, tx_in.owner_id)
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Proprietário com ID {tx_in.owner_id} não existe.",
            )

    if tx_in.card_id is not None and tx_in.card_id != tx.card_id:
        card = await db.get(Card, tx_in.card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cartão com ID {tx_in.card_id} não existe.",
            )

    if tx_in.type_id is not None and tx_in.type_id != tx.type_id:
        category = await db.get(Category, tx_in.type_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Categoria com ID {tx_in.type_id} não existe.",
            )

    # Cross-field installment check across updated and existing values
    effective_cur = tx_in.cur_parcs if tx_in.cur_parcs is not None else tx.cur_parcs
    effective_total = tx_in.total_parcs if tx_in.total_parcs is not None else tx.total_parcs
    if effective_cur > effective_total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A parcela atual ({effective_cur}) não pode ser maior que o total de parcelas ({effective_total}).",
        )

    update_data = tx_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(tx, field, value)

    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_transaction(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a transaction by ID."""
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )

    await db.delete(tx)
    await db.commit()
    return {"detail": f"Transação {id} excluída com sucesso."}


@router.patch("/{id}/toggle-paid", response_model=TransactionResponse, status_code=status.HTTP_200_OK)
async def toggle_paid_status(id: int, db: AsyncSession = Depends(get_db)):
    """
    Toggle payment status (is_paid) for a specific transaction.
    Implements Rule RN03 (Independent Payment Status).
    """
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )

    tx.is_paid = not tx.is_paid
    await db.commit()
    await db.refresh(tx)
    return tx


@router.post("/{id}/split", response_model=List[TransactionResponse], status_code=status.HTTP_200_OK)
async def split_transaction(
    id: int,
    payload: TransactionSplitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Split a transaction among multiple debt owners.
    Updates the original transaction with the first split portion and creates
    new sibling transactions for the subsequent split portions, linked via comments.
    """
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )

    split_sum = round(sum(s.amount for s in payload.splits), 2)
    original_val = round(tx.value, 2)
    if abs(split_sum - original_val) > 0.01:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A soma das partes do rateio (R$ {split_sum:.2f}) não confere com o valor total da compra (R$ {original_val:.2f}).",
        )

    # Validate that all owners exist
    for idx, s in enumerate(payload.splits):
        owner = await db.get(Owner, s.owner_id)
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Proprietário com ID {s.owner_id} (fatia {idx+1}) não existe.",
            )

    result_txs: List[Transaction] = []
    base_comment = tx.comment or ""

    # 1. Update the original transaction with the first split part
    first_split = payload.splits[0]
    tx.owner_id = first_split.owner_id
    tx.value = round(first_split.amount, 2)
    if first_split.is_paid is not None:
        tx.is_paid = first_split.is_paid
    owner_first = await db.get(Owner, first_split.owner_id)
    first_note = first_split.comment or f"Rateio 1/{len(payload.splits)} ({owner_first.name if owner_first else ''})"
    tx.comment = f"{base_comment} [{first_note}]".strip() if base_comment else f"[{first_note}]"
    result_txs.append(tx)

    # 2. Create sibling transactions for each subsequent split part
    for idx, s in enumerate(payload.splits[1:], start=2):
        s_owner = await db.get(Owner, s.owner_id)
        s_note = s.comment or f"Rateio {idx}/{len(payload.splits)} ({s_owner.name if s_owner else ''}) vinculado ao #{tx.id}"
        sib_tx = Transaction(
            dt_lcto=tx.dt_lcto,
            description=tx.description,
            value=round(s.amount, 2),
            owner_id=s.owner_id,
            card_id=tx.card_id,
            type_id=tx.type_id,
            total_parcs=tx.total_parcs,
            cur_parcs=tx.cur_parcs,
            comment=f"{base_comment} [{s_note}]".strip() if base_comment else f"[{s_note}]",
            invoice_month=tx.invoice_month,
            is_paid=s.is_paid if s.is_paid is not None else False,
            is_forecast=tx.is_forecast,
        )
        db.add(sib_tx)
        result_txs.append(sib_tx)

    await db.commit()
    for item in result_txs:
        await db.refresh(item)

    return result_txs


@router.post("/{id}/replicate-installments", response_model=List[TransactionResponse], status_code=status.HTTP_201_CREATED)
async def replicate_installments(
    id: int,
    payload: ReplicateInstallmentsRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Automatically replicate installment transactions across subsequent and/or past months.
    """
    tx = await db.get(Transaction, id)
    if not tx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transação com ID {id} não encontrada.",
        )

    if tx.total_parcs <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta transação não é parcelada (total de parcelas <= 1).",
        )

    # Determine base year and month
    base_year = tx.dt_lcto.year if tx.dt_lcto else 2026
    base_month = tx.dt_lcto.month if tx.dt_lcto else 11
    if tx.invoice_month and len(tx.invoice_month) >= 7:
        try:
            parts = tx.invoice_month.split("-")
            base_year = int(parts[0])
            base_month = int(parts[1])
        except Exception:
            pass

    targets: List[int] = []
    if payload.generate_future:
        targets.extend(range(tx.cur_parcs + 1, tx.total_parcs + 1))
    if payload.generate_past:
        targets.extend(range(1, tx.cur_parcs))

    created_installments: List[Transaction] = []

    for p in sorted(targets):
        delta = p - tx.cur_parcs
        tot_month = base_year * 12 + (base_month - 1) + delta
        target_year = tot_month // 12
        target_month_num = (tot_month % 12) + 1
        target_invoice_month = f"{target_year:04d}-{target_month_num:02d}"

        # Avoid duplicating an existing installment for the exact same target month and parcel number
        check_query = select(Transaction).where(
            Transaction.card_id == tx.card_id,
            Transaction.description == tx.description,
            Transaction.owner_id == tx.owner_id,
            Transaction.cur_parcs == p,
            Transaction.total_parcs == tx.total_parcs,
            Transaction.invoice_month == target_invoice_month,
        )
        existing = (await db.execute(check_query)).scalars().first()
        if existing:
            continue

        # Adjust dt_lcto safely with day capping
        try:
            import calendar
            max_day = calendar.monthrange(target_year, target_month_num)[1]
            day = min(tx.dt_lcto.day, max_day) if tx.dt_lcto else 10
            new_dt = datetime(target_year, target_month_num, day, 12, 0, 0, tzinfo=timezone.utc)
        except Exception:
            new_dt = datetime(target_year, target_month_num, 1, 12, 0, 0, tzinfo=timezone.utc)

        # Mark as forecast if target month is in the future relative to current invoice
        is_forecast = (target_invoice_month > tx.invoice_month) if tx.invoice_month else False

        new_inst = Transaction(
            dt_lcto=new_dt,
            description=tx.description,
            value=tx.value,
            owner_id=tx.owner_id,
            card_id=tx.card_id,
            type_id=tx.type_id,
            total_parcs=tx.total_parcs,
            cur_parcs=p,
            comment=f"Parcela {p}/{tx.total_parcs} (gerada automaticamente)",
            invoice_month=target_invoice_month,
            is_paid=False,
            is_forecast=is_forecast,
        )
        db.add(new_inst)
        created_installments.append(new_inst)

    await db.commit()
    for item in created_installments:
        await db.refresh(item)

    return created_installments
