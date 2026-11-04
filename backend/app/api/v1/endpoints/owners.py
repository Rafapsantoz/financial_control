from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.schemas.owner import OwnerCreate, OwnerUpdate, OwnerResponse

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
