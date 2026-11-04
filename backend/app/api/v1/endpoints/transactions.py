from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.owner import Owner
from app.models.card import Card
from app.models.category import Category
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
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

    # Date range filtering for month (index-friendly and timezone-safe)
    if month:
        year_str, month_str = month.split("-")
        year = int(year_str)
        month_num = int(month_str)
        start_date = datetime(year, month_num, 1, 0, 0, 0, tzinfo=timezone.utc)
        if month_num == 12:
            end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        else:
            end_date = datetime(year, month_num + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        query = query.where(Transaction.dt_lcto >= start_date, Transaction.dt_lcto < end_date)

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

    db_tx = Transaction(**tx_in.model_dump())
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
