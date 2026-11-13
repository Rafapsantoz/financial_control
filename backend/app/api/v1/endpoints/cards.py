from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.card import Card
from app.models.transaction import Transaction
from app.schemas.card import CardCreate, CardUpdate, CardResponse
from app.services.audit_service import record_audit_log, serialize_data

router = APIRouter()


@router.get("", response_model=List[CardResponse], status_code=status.HTTP_200_OK)
async def list_cards(db: AsyncSession = Depends(get_db)):
    """List all registered credit cards."""
    query = select(Card).order_by(Card.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_card(card_in: CardCreate, db: AsyncSession = Depends(get_db)):
    """Register a new credit card with unique name validation and audit logging."""
    query = select(Card).where(func.lower(Card.card_name) == func.lower(card_in.card_name))
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cartão com o nome '{card_in.card_name}' já existe.",
        )

    db_card = Card(**card_in.model_dump())
    db.add(db_card)
    await db.flush()

    await record_audit_log(
        db=db,
        action="CREATE",
        entity_type="CARD",
        entity_id=db_card.id,
        description=f"Cartão '{db_card.card_name}' cadastrado (Limite: R$ {db_card.total_limit or 0:.2f})",
        new_values=db_card,
    )

    await db.commit()
    await db.refresh(db_card)
    return db_card


@router.get("/{id}", response_model=CardResponse, status_code=status.HTTP_200_OK)
async def get_card(id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a credit card by ID."""
    card = await db.get(Card, id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cartão com ID {id} não encontrado.",
        )
    return card


@router.put("/{id}", response_model=CardResponse, status_code=status.HTTP_200_OK)
async def update_card(id: int, card_in: CardUpdate, db: AsyncSession = Depends(get_db)):
    """Update credit card information with audit logging."""
    card = await db.get(Card, id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cartão com ID {id} não encontrado.",
        )

    if card_in.card_name is not None and card_in.card_name.lower() != card.card_name.lower():
        query = select(Card).where(func.lower(Card.card_name) == func.lower(card_in.card_name), Card.id != id)
        conflict = await db.execute(query)
        if conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Outro cartão com o nome '{card_in.card_name}' já existe.",
            )

    old_snapshot = serialize_data(card)

    update_data = card_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(card, field, value)

    await record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="CARD",
        entity_id=card.id,
        description=f"Cartão #{card.id} '{card.card_name}' alterado",
        old_values=old_snapshot,
        new_values=card,
    )

    await db.commit()
    await db.refresh(card)
    return card


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_card(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a credit card if no transactions are linked, preserving audit snapshot."""
    card = await db.get(Card, id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cartão com ID {id} não encontrado.",
        )

    tx_query = select(func.count(Transaction.id)).where(Transaction.card_id == id)
    tx_count = await db.scalar(tx_query)
    if tx_count and tx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Não é possível excluir o cartão: existem {tx_count} transações vinculadas a ele.",
        )

    old_snapshot = serialize_data(card)
    await record_audit_log(
        db=db,
        action="DELETE",
        entity_type="CARD",
        entity_id=id,
        description=f"Cartão #{id} '{card.card_name}' excluído",
        old_values=old_snapshot,
    )

    await db.delete(card)
    await db.commit()
    return {"detail": f"Cartão {id} excluído com sucesso."}
