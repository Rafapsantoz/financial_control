from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
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

    # 1. Update the original transaction with the first split part
    first_split = payload.splits[0]
    tx.owner_id = first_split.owner_id
    tx.value = round(first_split.amount, 2)
    if first_split.is_paid is not None:
        tx.is_paid = first_split.is_paid
    owner_first = await db.get(Owner, first_split.owner_id)
    first_note = first_split.comment or f"Rateio 1/{len(payload.splits)} ({owner_first.name if owner_first else ''})"
    tx.comment = f"{tx.comment} [{first_note}]".strip() if tx.comment else first_note
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
            comment=f"{tx.comment or ''} [{s_note}]".strip() if tx.comment else s_note,
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
