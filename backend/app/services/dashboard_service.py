import re
from datetime import datetime, timezone
from typing import Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.schemas.dashboard import (
    CategorySummary,
    DashboardSummaryResponse,
    OwnerSummary,
)

MONTH_REGEX = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


async def get_dashboard_summary(
    db: AsyncSession,
    month: str,
    card_id: Optional[int] = None,
) -> DashboardSummaryResponse:
    """
    Computes family rateio summary, individual payment status (RN03),
    strict value conservation, and category breakdown for a reference month.
    Future forecast transactions (is_forecast == True) are strictly ignored.
    """
    # 1. Validate month format
    if not month or not MONTH_REGEX.match(month):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Formato de mês inválido: '{month}'. Utilize o formato YYYY-MM (ex: 2026-11).",
        )

    # 2. Validate card existence if card_id is provided
    if card_id is not None:
        card = await db.get(Card, card_id)
        if not card:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cartão com ID {card_id} não encontrado.",
            )

    # 3. Calculate date range for the specified month
    year_str, month_str = month.split("-")
    year = int(year_str)
    month_num = int(month_str)
    start_date = datetime(year, month_num, 1, 0, 0, 0, tzinfo=timezone.utc)
    if month_num == 12:
        end_date = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    else:
        end_date = datetime(year, month_num + 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # 4. Query transactions: matches invoice_month == month OR (invoice_month is None and dt_lcto within month)
    month_filter = or_(
        Transaction.invoice_month == month,
        and_(
            Transaction.invoice_month.is_(None),
            Transaction.dt_lcto >= start_date,
            Transaction.dt_lcto < end_date,
        ),
    )
    stmt = select(Transaction).where(
        month_filter,
        Transaction.is_forecast == False,
    )
    if card_id is not None:
        stmt = stmt.where(Transaction.card_id == card_id)

    stmt = stmt.order_by(Transaction.dt_lcto.asc(), Transaction.id.asc())
    res = await db.execute(stmt)
    transactions = res.scalars().all()

    # 5. Strict value conservation: total_amount = total_paid + total_pending
    total_paid = round(sum(round(tx.value, 2) for tx in transactions if tx.is_paid), 2)
    total_pending = round(sum(round(tx.value, 2) for tx in transactions if not tx.is_paid), 2)
    total_amount = round(total_paid + total_pending, 2)

    # 6. Per-owner split and independent payment status (RN03)
    owners_res = await db.execute(select(Owner).order_by(Owner.id.asc()))
    all_owners = owners_res.scalars().all()

    owners_summary: List[OwnerSummary] = []
    for owner in all_owners:
        owner_txs = [tx for tx in transactions if tx.owner_id == owner.id]
        tx_count = len(owner_txs)
        if tx_count == 0:
            owner_total = 0.0
            owner_paid = 0.0
            owner_pending = 0.0
            owner_status = "Sem despesas"
        else:
            owner_paid = round(sum(round(tx.value, 2) for tx in owner_txs if tx.is_paid), 2)
            owner_pending = round(sum(round(tx.value, 2) for tx in owner_txs if not tx.is_paid), 2)
            owner_total = round(owner_paid + owner_pending, 2)

            if owner_total == 0.0:
                owner_status = "Sem despesas"
            elif owner_pending == 0.0:
                owner_status = "Pago"
            elif owner_paid == 0.0:
                owner_status = "Pendente"
            else:
                owner_status = "Parcial"

        owners_summary.append(
            OwnerSummary(
                owner_id=owner.id,
                owner_name=owner.name,
                total_amount=owner_total,
                paid_amount=owner_paid,
                pending_amount=owner_pending,
                status=owner_status,
                transactions_count=tx_count,
            )
        )

    # 7. Category breakdown with percentage relative to invoice total
    cats_res = await db.execute(select(Category))
    categories = cats_res.scalars().all()
    categories_by_id = {c.id: c.description for c in categories}

    cat_totals: Dict[int, float] = {}
    for tx in transactions:
        if tx.type_id is not None:
            cat_totals[tx.type_id] = cat_totals.get(tx.type_id, 0.0) + round(tx.value, 2)
        else:
            # Fallback unassigned category to 'Outros' if it exists
            outros_id = next((cid for cid, name in categories_by_id.items() if name.lower() == "outros"), None)
            if outros_id is not None:
                cat_totals[outros_id] = cat_totals.get(outros_id, 0.0) + round(tx.value, 2)

    # Sort categories by total_amount desc, then name asc
    sorted_categories = sorted(
        cat_totals.items(),
        key=lambda item: (-round(item[1], 2), categories_by_id.get(item[0], "")),
    )

    category_summary: List[CategorySummary] = []
    for cid, c_amount in sorted_categories:
        rounded_c_amount = round(c_amount, 2)
        if total_amount > 0.0:
            percentage = round((rounded_c_amount / total_amount) * 100.0, 2)
            percentage = min(100.0, max(0.0, percentage))
        else:
            percentage = 0.0

        category_summary.append(
            CategorySummary(
                category_id=cid,
                category_name=categories_by_id.get(cid, "Outros"),
                total_amount=rounded_c_amount,
                percentage=percentage,
            )
        )

    return DashboardSummaryResponse(
        month=month,
        card_id=card_id,
        total_amount=total_amount,
        total_paid=total_paid,
        total_pending=total_pending,
        owners_summary=owners_summary,
        category_summary=category_summary,
    )
