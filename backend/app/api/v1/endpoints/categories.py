from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.category import Category
from app.models.transaction import Transaction
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
from app.services.audit_service import record_audit_log, serialize_data

router = APIRouter()


@router.get("", response_model=List[CategoryResponse], status_code=status.HTTP_200_OK)
async def list_categories(db: AsyncSession = Depends(get_db)):
    """List all expense categories."""
    query = select(Category).order_by(Category.id)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(category_in: CategoryCreate, db: AsyncSession = Depends(get_db)):
    """Create a new expense category with uniqueness check and audit logging."""
    query = select(Category).where(func.lower(Category.description) == func.lower(category_in.description))
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Categoria '{category_in.description}' já existe.",
        )

    db_cat = Category(**category_in.model_dump())
    db.add(db_cat)
    await db.flush()

    await record_audit_log(
        db=db,
        action="CREATE",
        entity_type="CATEGORY",
        entity_id=db_cat.id,
        description=f"Categoria '{db_cat.description}' criada (Custo Fixo: R$ {db_cat.fixed_cost or 0:.2f})",
        new_values=db_cat,
    )

    await db.commit()
    await db.refresh(db_cat)
    return db_cat


@router.get("/summary/fixed-costs", status_code=status.HTTP_200_OK)
async def get_fixed_costs_summary(db: AsyncSession = Depends(get_db)):
    """Retorna a somatória total de custos fixos cadastrados por categoria."""
    query = select(Category).order_by(Category.id)
    result = await db.execute(query)
    cats = result.scalars().all()
    total = sum(c.fixed_cost or 0.0 for c in cats)
    categories_with_fixed = [
        {"id": c.id, "description": c.description, "fixed_cost": c.fixed_cost or 0.0}
        for c in cats
        if (c.fixed_cost or 0.0) > 0
    ]
    return {
        "total_fixed_cost": round(total, 2),
        "count_with_fixed": len(categories_with_fixed),
        "total_categories": len(cats),
        "categories": categories_with_fixed,
    }


@router.get("/{id}", response_model=CategoryResponse, status_code=status.HTTP_200_OK)
async def get_category(id: int, db: AsyncSession = Depends(get_db)):
    """Retrieve details of a category by ID."""
    cat = await db.get(Category, id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoria com ID {id} não encontrada.",
        )
    return cat


@router.put("/{id}", response_model=CategoryResponse, status_code=status.HTTP_200_OK)
async def update_category(id: int, category_in: CategoryUpdate, db: AsyncSession = Depends(get_db)):
    """Update category description with audit logging."""
    cat = await db.get(Category, id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoria com ID {id} não encontrada.",
        )

    if category_in.description is not None and category_in.description.lower() != cat.description.lower():
        query = select(Category).where(
            func.lower(Category.description) == func.lower(category_in.description),
            Category.id != id,
        )
        conflict = await db.execute(query)
        if conflict.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Outra categoria com a descrição '{category_in.description}' já existe.",
            )

    old_snapshot = serialize_data(cat)

    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(cat, field, value)

    await record_audit_log(
        db=db,
        action="UPDATE",
        entity_type="CATEGORY",
        entity_id=cat.id,
        description=f"Categoria #{cat.id} '{cat.description}' alterada",
        old_values=old_snapshot,
        new_values=cat,
    )

    await db.commit()
    await db.refresh(cat)
    return cat


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_category(id: int, db: AsyncSession = Depends(get_db)):
    """Delete a category if no transactions are linked, preserving full audit snapshot."""
    cat = await db.get(Category, id)
    if not cat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Categoria com ID {id} não encontrada.",
        )

    tx_query = select(func.count(Transaction.id)).where(Transaction.type_id == id)
    tx_count = await db.scalar(tx_query)
    if tx_count and tx_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Não é possível excluir a categoria: existem {tx_count} transações vinculadas a ela.",
        )

    old_snapshot = serialize_data(cat)
    await record_audit_log(
        db=db,
        action="DELETE",
        entity_type="CATEGORY",
        entity_id=id,
        description=f"Categoria #{id} '{cat.description}' excluída",
        old_values=old_snapshot,
    )

    await db.delete(cat)
    await db.commit()
    return {"detail": f"Categoria {id} excluída com sucesso."}
