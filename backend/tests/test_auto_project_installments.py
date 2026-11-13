import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.transaction import Transaction

@pytest.mark.asyncio
async def test_project_all_installments_endpoint(client: AsyncClient, db_session: AsyncSession):
    # 1. Create a base installment transaction (e.g. 2/4)
    tx_payload = {
        "description": "Curso Online PARC02/04",
        "value": 150.00,
        "owner_id": 1,
        "card_id": 1,
        "type_id": 1,
        "cur_parcs": 2,
        "total_parcs": 4,
        "invoice_month": "2026-11",
        "entry_type": "expense",
        "is_paid": False,
        "is_forecast": False,
    }
    create_res = await client.post("/api/v1/transactions", json=tx_payload)
    assert create_res.status_code == 201

    # 2. Call project-all-installments endpoint
    proj_res = await client.post("/api/v1/transactions/project-all-installments")
    assert proj_res.status_code == 200
    data = proj_res.json()
    assert data["status"] == "success"
    assert data["created_count"] >= 3  # Parcela 1/4 (2026-10), 3/4 (2026-12), 4/4 (2027-01)

    # 3. Check database persistence
    res = await db_session.execute(
        select(Transaction).where(Transaction.description.like("%Curso Online%"))
    )
    all_installments = res.scalars().all()
    parc_numbers = sorted([t.cur_parcs for t in all_installments])
    assert parc_numbers == [1, 2, 3, 4]

    # Verify parcel 1 is in 2026-10 and marked paid/past
    p1 = next(t for t in all_installments if t.cur_parcs == 1)
    assert p1.invoice_month == "2026-10"
    assert "PARC01/04" in p1.description

    # Verify parcel 3 is in 2026-12 and forecast
    p3 = next(t for t in all_installments if t.cur_parcs == 3)
    assert p3.invoice_month == "2026-12"
    assert p3.is_forecast is True
    assert "PARC03/04" in p3.description

    # 4. Test idempotency: calling again should create 0 new installments for this transaction
    proj_res2 = await client.post("/api/v1/transactions/project-all-installments")
    assert proj_res2.status_code == 200
    assert proj_res2.json()["created_count"] == 0
