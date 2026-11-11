from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.schemas.owner import (
    OwnerCreate,
    OwnerUpdate,
    OwnerResponse,
    OwnerSettleRequest,
    OwnerSettleResponse,
)

router = APIRouter()


@router.get("", response_model=List[OwnerResponse], status_code=status.HTTP_200_OK)
async def list_owners(db: AsyncSession = Depends(get_db)):
    """List all registered debt owners."""
    query = select(Owner).order_by(Owner.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=OwnerResponse, status_code=status.HTTP_201_CREATED)
async def create_owner(owner_in: OwnerCreate, db: AsyncSession = Depends(get_db)):
    """Register a new owner with unique name validation."""
    query = select(Owner).where(func.lower(Owner.name) == func.lower(owner_in.name))
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Proprietário com o nome '{owner_in.name}' já existe.",
        )

    db_owner = Owner(**owner_in.model_dump())
    db.add(db_owner)
    await db.commit()
    await db.refresh(db_owner)
    return db_owner


@router.get("/{id}", response_model=OwnerResponse, status_code=status.HTTP_200_OK)
async def get_owner(id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a single owner by ID."""
    owner = await db.get(Owner, id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proprietário com ID {id} não encontrado.",
        )
    return owner


@router.put("/{id}", response_model=OwnerResponse, status_code=status.HTTP_200_OK)
async def update_owner(id: int, owner_in: OwnerUpdate, db: AsyncSession = Depends(get_db)):
    """Update owner information."""
    owner = await db.get(Owner, id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proprietário com ID {id} não encontrado.",
        )

    if owner_in.name is not None and owner_in.name.lower() != owner.name.lower():
        query = select(Owner).where(func.lower(Owner.name) == func.lower(owner_in.name), Owner.id != id)
        conflict = await db.execute(query)
        if conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Outro proprietário com o nome '{owner_in.name}' já existe.",
            )

    update_data = owner_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(owner, field, value)

    await db.commit()
    await db.refresh(owner)
    return owner


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_owner(id: int, db: AsyncSession = Depends(get_db)):
    """Delete an owner if no active transactions are associated."""
    owner = await db.get(Owner, id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proprietário com ID {id} não encontrado.",
        )

    # Check for active transactions linked to this owner (RESTRICT constraint)
    tx_query = select(func.count(Transaction.id)).where(Transaction.owner_id == id)
    tx_count = await db.scalar(tx_query)
    if tx_count and tx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Não é possível excluir o proprietário: existem {tx_count} transações vinculadas a ele.",
        )

    await db.delete(owner)
    await db.commit()
    return {"detail": f"Proprietário {id} excluído com sucesso."}


@router.post("/{id}/settle", response_model=OwnerSettleResponse, status_code=status.HTTP_200_OK)
async def settle_owner_debt(
    id: int,
    payload: OwnerSettleRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Settle debts in cascade for a specific owner in a given month.
    Allocates payment_amount across pending transactions. Smaller/older debts are
    cleared first. If a payment only partially covers a transaction, it splits
    it into a fully paid portion and a remaining pending portion.
    """
    owner = await db.get(Owner, id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proprietário com ID {id} não encontrado.",
        )

    # Fetch pending transactions for this owner in the target month (EXCLUDING forecasts: RN-Previsto)
    query = (
        select(Transaction)
        .where(
            Transaction.owner_id == id,
            Transaction.invoice_month == payload.month,
            Transaction.is_paid == False,
            Transaction.is_forecast == False,
        )
        .order_by(Transaction.value.asc(), Transaction.dt_lcto.asc(), Transaction.id.asc())
    )
    pending_txs = (await db.execute(query)).scalars().all()

    if not pending_txs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não há despesas efetivas pendentes de pagamento para {owner.name} no mês {payload.month} (gastos previstos/estimados não entram em quitação).",
        )

    remaining = round(payload.payment_amount, 2)
    fully_settled = 0
    partially_settled = 0

    for tx in pending_txs:
        if remaining <= 0:
            break

        tx_val = round(tx.value, 2)
        if remaining >= tx_val:
            tx.is_paid = True
            remaining = round(remaining - tx_val, 2)
            fully_settled += 1
        else:
            # Partial abatement: split tx into paid portion and remaining debt
            paid_portion = remaining
            unpaid_remainder = round(tx_val - paid_portion, 2)

            # Update current transaction to paid portion
            tx.value = paid_portion
            tx.is_paid = True
            tx.comment = f"{tx.comment or ''} [Quitado R$ {paid_portion:.2f} do total de R$ {tx_val:.2f}]".strip()

            # Create remaining debt as a new pending transaction
            rem_tx = Transaction(
                dt_lcto=tx.dt_lcto,
                description=tx.description,
                value=unpaid_remainder,
                owner_id=tx.owner_id,
                card_id=tx.card_id,
                type_id=tx.type_id,
                total_parcs=tx.total_parcs,
                cur_parcs=tx.cur_parcs,
                comment=f"{tx.comment or ''} [Saldo restante de R$ {unpaid_remainder:.2f} pós quitação parcial de #{tx.id}]".strip(),
                invoice_month=tx.invoice_month,
                is_paid=False,
                is_forecast=tx.is_forecast,
            )
            db.add(rem_tx)
            partially_settled += 1
            remaining = 0.0
            break

    await db.commit()

    # Calculate remaining debt for this owner after settlement (effective debts only)
    rem_sum_query = select(func.coalesce(func.sum(Transaction.value), 0.0)).where(
        Transaction.owner_id == id,
        Transaction.invoice_month == payload.month,
        Transaction.is_paid == False,
        Transaction.is_forecast == False,
    )
    total_remaining_pending = round(float(await db.scalar(rem_sum_query) or 0.0), 2)

    msg = (
        f"Quitação de R$ {payload.payment_amount:.2f} processada com sucesso para {owner.name}! "
        f"{fully_settled} título(s) quitado(s) integralmente"
        + (f" e {partially_settled} título com abatimento parcial." if partially_settled else ".")
    )

    return OwnerSettleResponse(
        owner_id=id,
        settled_amount=round(payload.payment_amount - remaining, 2),
        fully_settled_count=fully_settled,
        partially_settled_count=partially_settled,
        remaining_pending=total_remaining_pending,
        message=msg,
    )
