from datetime import datetime, timezone
import pytest
from httpx import AsyncClient


# ==============================================================================
# 1. FLOATING-POINT CENT SUMS & STRICT VALUE CONSERVATION
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_floating_point_cent_sums_zero_drift(client: AsyncClient):
    """
    Adversarial Challenge: Floating-point cent sums and rounding (e.g. 19.99 + 33.33 + 0.01).
    Verifies that value conservation has ZERO drift:
    - total_amount == round(total_paid + total_pending, 2)
    - total_amount == 53.33
    - total_paid == 20.00 (19.99 + 0.01)
    - total_pending == 33.33
    """
    owners_res = await client.get("/api/v1/owners")
    assert owners_res.status_code == 200
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]

    month = "2026-05"

    # Transaction 1: 19.99 (paid)
    res1 = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T10:00:00Z",
        "description": "Tx 19.99 Paid",
        "value": 19.99,
        "owner_id": rafael_id,
        "is_paid": True,
    })
    assert res1.status_code == 201

    # Transaction 2: 33.33 (unpaid)
    res2 = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T11:00:00Z",
        "description": "Tx 33.33 Pending",
        "value": 33.33,
        "owner_id": mae_id,
        "is_paid": False,
    })
    assert res2.status_code == 201

    # Transaction 3: 0.01 (paid)
    res3 = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-15T12:00:00Z",
        "description": "Tx 0.01 Paid",
        "value": 0.01,
        "owner_id": rafael_id,
        "is_paid": True,
    })
    assert res3.status_code == 201

    # Fetch dashboard summary
    dash_res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert dash_res.status_code == 200
    data = dash_res.json()

    # Exact expected numbers
    expected_paid = 20.00     # 19.99 + 0.01
    expected_pending = 33.33  # 33.33
    expected_total = 53.33    # 20.00 + 33.33

    assert data["total_paid"] == expected_paid
    assert data["total_pending"] == expected_pending
    assert data["total_amount"] == expected_total

    # Strict zero drift conservation check
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # Owner summaries check
    owners_dict = {o["owner_name"]: o for o in data["owners_summary"]}

    raf = owners_dict["Rafael"]
    assert raf["total_amount"] == 20.00
    assert raf["paid_amount"] == 20.00
    assert raf["pending_amount"] == 0.00
    assert raf["status"] == "Pago"
    assert raf["total_amount"] == round(raf["paid_amount"] + raf["pending_amount"], 2)

    mae = owners_dict["Mãe"]
    assert mae["total_amount"] == 33.33
    assert mae["paid_amount"] == 0.00
    assert mae["pending_amount"] == 33.33
    assert mae["status"] == "Pendente"
    assert mae["total_amount"] == round(mae["paid_amount"] + mae["pending_amount"], 2)


@pytest.mark.asyncio
async def test_adversarial_monte_carlo_cent_conservation(client: AsyncClient):
    """
    Stress test value conservation across 60 transactions with adversarial decimal cents
    (e.g. 0.01, 0.07, 0.13, 0.33, 0.99, etc.) distributed across owners.
    Guarantees that no cumulative floating-point IEEE 754 drift occurs.
    """
    owners_res = await client.get("/api/v1/owners")
    owners = owners_res.json()
    owner_ids = [o["id"] for o in owners]

    month = "2026-06"
    test_values = [
        0.01, 0.03, 0.07, 0.09, 0.11, 0.13, 0.17, 0.19, 0.23, 0.29,
        0.31, 0.33, 0.37, 0.41, 0.43, 0.47, 0.53, 0.59, 0.61, 0.67,
        0.71, 0.73, 0.79, 0.83, 0.89, 0.97, 0.99, 1.01, 2.33, 5.77,
        7.19, 9.99, 12.34, 15.67, 19.99, 23.45, 27.89, 31.01, 33.33, 37.50,
        41.11, 45.99, 49.95, 53.07, 57.81, 61.23, 67.45, 71.89, 73.15, 79.99,
        83.21, 87.65, 89.01, 93.44, 97.88, 99.99, 103.55, 127.33, 150.01, 199.99,
    ]

    expected_paid_sum = 0.0
    expected_pending_sum = 0.0

    for i, val in enumerate(test_values):
        is_paid = (i % 2 == 0)
        owner_id = owner_ids[i % len(owner_ids)]

        if is_paid:
            expected_paid_sum = round(expected_paid_sum + val, 2)
        else:
            expected_pending_sum = round(expected_pending_sum + val, 2)

        day = f"{(i % 28) + 1:02d}"
        await client.post("/api/v1/transactions", json={
            "dt_lcto": f"{month}-{day}T12:00:00Z",
            "description": f"Stress Tx {i}",
            "value": val,
            "owner_id": owner_id,
            "is_paid": is_paid,
        })

    dash_res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert dash_res.status_code == 200
    data = dash_res.json()

    assert data["total_paid"] == expected_paid_sum
    assert data["total_pending"] == expected_pending_sum
    assert data["total_amount"] == round(expected_paid_sum + expected_pending_sum, 2)

    # Zero drift invoice-level
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # Zero drift per owner
    sum_owners_total = 0.0
    for o in data["owners_summary"]:
        assert o["total_amount"] == round(o["paid_amount"] + o["pending_amount"], 2)
        sum_owners_total = round(sum_owners_total + o["total_amount"], 2)

    # Sum of owner totals equals invoice total (since all transactions have owner_id)
    assert sum_owners_total == data["total_amount"]


@pytest.mark.asyncio
async def test_adversarial_cent_split_one_hundred_cents(client: AsyncClient):
    """
    100 transactions of R$ 0.01 each:
    33 paid transactions -> R$ 0.33
    67 unpaid transactions -> R$ 0.67
    Total must equal exactly R$ 1.00 with zero drift.
    """
    month = "2026-07"
    for i in range(100):
        is_paid = (i < 33)
        await client.post("/api/v1/transactions", json={
            "dt_lcto": f"{month}-01T10:00:00Z",
            "description": f"Cent Tx {i}",
            "value": 0.01,
            "is_paid": is_paid,
        })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 1.00
    assert data["total_paid"] == 0.33
    assert data["total_pending"] == 0.67
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)


# ==============================================================================
# 2. TOGGLE-PAID DYNAMICS & REAL-TIME DASHBOARD UPDATES
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_toggle_paid_multi_transaction_dynamics(client: AsyncClient):
    """
    Adversarial: Toggle multiple transactions back and forth repeatedly,
    verifying at each transition that:
    1. Dashboard summary updates immediately.
    2. Statuses properly cycle: Sem despesas -> Pendente -> Parcial -> Pago -> Parcial -> Pendente.
    3. Invoice totals and owner quotas remain perfectly consistent.
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]

    month = "2026-08"

    # Step 1: Initial state -> 0 transactions -> "Sem despesas"
    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Sem despesas"
    assert dash["total_amount"] == 0.0

    # Step 2: Create Tx1 (unpaid) for Rafael: 100.00 -> Status: Pendente
    tx1_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-02T10:00:00Z",
        "description": "Rafael Item 1",
        "value": 100.00,
        "owner_id": rafael_id,
        "is_paid": False,
    })
    tx1_id = tx1_res.json()["id"]

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Pendente"
    assert raf["paid_amount"] == 0.00
    assert raf["pending_amount"] == 100.00
    assert dash["total_amount"] == 100.00
    assert dash["total_pending"] == 100.00

    # Step 3: Create Tx2 (unpaid) for Rafael: 50.00 -> Status still: Pendente
    tx2_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-03T10:00:00Z",
        "description": "Rafael Item 2",
        "value": 50.00,
        "owner_id": rafael_id,
        "is_paid": False,
    })
    tx2_id = tx2_res.json()["id"]

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Pendente"
    assert raf["pending_amount"] == 150.00

    # Step 4: Toggle Tx1 to Paid -> Rafael has 1 paid (100) and 1 pending (50) -> Parcial
    t1 = await client.patch(f"/api/v1/transactions/{tx1_id}/toggle-paid")
    assert t1.status_code == 200
    assert t1.json()["is_paid"] is True

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Parcial"
    assert raf["paid_amount"] == 100.00
    assert raf["pending_amount"] == 50.00
    assert dash["total_paid"] == 100.00
    assert dash["total_pending"] == 50.00

    # Step 5: Toggle Tx2 to Paid -> Rafael has 2 paid (150) and 0 pending -> Pago
    t2 = await client.patch(f"/api/v1/transactions/{tx2_id}/toggle-paid")
    assert t2.status_code == 200
    assert t2.json()["is_paid"] is True

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Pago"
    assert raf["paid_amount"] == 150.00
    assert raf["pending_amount"] == 0.00
    assert dash["total_paid"] == 150.00
    assert dash["total_pending"] == 0.00

    # Step 6: Create Tx3 for Mãe (unpaid): 200.00
    tx3_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-04T10:00:00Z",
        "description": "Mãe Item 1",
        "value": 200.00,
        "owner_id": mae_id,
        "is_paid": False,
    })
    tx3_id = tx3_res.json()["id"]

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    mae = next(o for o in dash["owners_summary"] if o["owner_name"] == "Mãe")
    assert raf["status"] == "Pago"
    assert mae["status"] == "Pendente"
    assert dash["total_amount"] == 350.00
    assert dash["total_paid"] == 150.00
    assert dash["total_pending"] == 200.00

    # Step 7: Toggle Tx1 back to Unpaid -> Rafael becomes Parcial (50 paid, 100 pending)
    t1_back = await client.patch(f"/api/v1/transactions/{tx1_id}/toggle-paid")
    assert t1_back.status_code == 200
    assert t1_back.json()["is_paid"] is False

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Parcial"
    assert raf["paid_amount"] == 50.00
    assert raf["pending_amount"] == 100.00
    assert dash["total_paid"] == 50.00
    assert dash["total_pending"] == 300.00  # 100 raf + 200 mae

    # Step 8: Toggle Tx2 back to Unpaid -> Rafael becomes Pendente (0 paid, 150 pending)
    t2_back = await client.patch(f"/api/v1/transactions/{tx2_id}/toggle-paid")
    assert t2_back.status_code == 200
    assert t2_back.json()["is_paid"] is False

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["status"] == "Pendente"
    assert raf["paid_amount"] == 0.00
    assert raf["pending_amount"] == 150.00
    assert dash["total_paid"] == 0.00
    assert dash["total_pending"] == 350.00

    # Step 9: Toggle Tx3 (Mãe) to Paid -> Mãe becomes Pago
    t3 = await client.patch(f"/api/v1/transactions/{tx3_id}/toggle-paid")
    assert t3.status_code == 200
    assert t3.json()["is_paid"] is True

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    mae = next(o for o in dash["owners_summary"] if o["owner_name"] == "Mãe")
    assert mae["status"] == "Pago"
    assert mae["paid_amount"] == 200.00
    assert mae["pending_amount"] == 0.00
    assert dash["total_paid"] == 200.00
    assert dash["total_pending"] == 150.00


@pytest.mark.asyncio
async def test_adversarial_toggle_nonexistent_transaction_404(client: AsyncClient):
    """
    Adversarial: Attempting to toggle payment status on non-existent transaction IDs
    must return HTTP 404 Not Found.
    """
    bad_ids = [999999, 0, -1]
    for bad_id in bad_ids:
        res = await client.patch(f"/api/v1/transactions/{bad_id}/toggle-paid")
        assert res.status_code == 404, f"Expected 404 for tx ID {bad_id}, got {res.status_code}"
        assert "não encontrada" in res.json()["detail"]


# ==============================================================================
# 3. EDGE-CASE MONTHS
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_edge_case_month_zero_expenses(client: AsyncClient):
    """
    Adversarial: Month with strictly 0 expenses.
    - total_amount == 0.0, total_paid == 0.0, total_pending == 0.0
    - All registered owners (Rafael, Mãe, Irmã) present with status 'Sem despesas'
    - category_summary must be empty list
    - Zero conservation drift
    """
    month = "2025-01"
    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["month"] == month
    assert data["card_id"] is None
    assert data["total_amount"] == 0.0
    assert data["total_paid"] == 0.0
    assert data["total_pending"] == 0.0
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)
    assert data["category_summary"] == []

    owners_dict = {o["owner_name"]: o for o in data["owners_summary"]}
    for name in ["Rafael", "Mãe", "Irmã"]:
        assert name in owners_dict
        o = owners_dict[name]
        assert o["status"] == "Sem despesas"
        assert o["total_amount"] == 0.0
        assert o["paid_amount"] == 0.0
        assert o["pending_amount"] == 0.0
        assert o["transactions_count"] == 0


@pytest.mark.asyncio
async def test_adversarial_edge_case_one_owner_paid_two_unpaid(client: AsyncClient):
    """
    Adversarial: Month with 1 owner paid and 2 unpaid:
    - Rafael: 1 transaction of R$ 150.00, is_paid=True -> status: "Pago"
    - Mãe: 1 transaction of R$ 250.00, is_paid=False -> status: "Pendente"
    - Irmã: 2 transactions (R$ 80.00 + R$ 70.00 = R$ 150.00), is_paid=False -> status: "Pendente"
    - Strict conservation verification
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}

    month = "2025-02"

    # Rafael (Paid)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Rafael Expense",
        "value": 150.00,
        "owner_id": owners_map["Rafael"],
        "is_paid": True,
    })

    # Mãe (Unpaid)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-06T12:00:00Z",
        "description": "Mãe Expense",
        "value": 250.00,
        "owner_id": owners_map["Mãe"],
        "is_paid": False,
    })

    # Irmã (Unpaid 1 & Unpaid 2)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-07T12:00:00Z",
        "description": "Irmã Expense 1",
        "value": 80.00,
        "owner_id": owners_map["Irmã"],
        "is_paid": False,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-08T12:00:00Z",
        "description": "Irmã Expense 2",
        "value": 70.00,
        "owner_id": owners_map["Irmã"],
        "is_paid": False,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    # Invoice totals
    assert data["total_amount"] == 550.00
    assert data["total_paid"] == 150.00
    assert data["total_pending"] == 400.00
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    owners_dict = {o["owner_name"]: o for o in data["owners_summary"]}

    # Rafael -> Pago
    raf = owners_dict["Rafael"]
    assert raf["status"] == "Pago"
    assert raf["total_amount"] == 150.00
    assert raf["paid_amount"] == 150.00
    assert raf["pending_amount"] == 0.00

    # Mãe -> Pendente
    mae = owners_dict["Mãe"]
    assert mae["status"] == "Pendente"
    assert mae["total_amount"] == 250.00
    assert mae["paid_amount"] == 0.00
    assert mae["pending_amount"] == 250.00

    # Irmã -> Pendente
    irma = owners_dict["Irmã"]
    assert irma["status"] == "Pendente"
    assert irma["total_amount"] == 150.00
    assert irma["paid_amount"] == 0.00
    assert irma["pending_amount"] == 150.00


@pytest.mark.asyncio
async def test_adversarial_edge_case_unassigned_owner_only(client: AsyncClient):
    """
    Adversarial: Month with only unassigned transactions (owner_id=None):
    - All transactions must be accounted for in total_amount, total_paid, total_pending.
    - All registered family members remain 'Sem despesas' with 0.00.
    - Category summary properly reflects the purchases.
    - Conservation: total_amount == total_paid + total_pending.
    """
    cats_res = await client.get("/api/v1/categories")
    cats_map = {c["description"]: c["id"] for c in cats_res.json()}

    month = "2025-03"

    # Tx1: 99.90, paid=True, Mercado
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T14:00:00Z",
        "description": "Unassigned Paid",
        "value": 99.90,
        "owner_id": None,
        "type_id": cats_map["Mercado"],
        "is_paid": True,
    })

    # Tx2: 45.10, paid=False, Lazer
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-15T16:00:00Z",
        "description": "Unassigned Pending 1",
        "value": 45.10,
        "owner_id": None,
        "type_id": cats_map["Lazer"],
        "is_paid": False,
    })

    # Tx3: 5.00, paid=False, Outros
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-20T18:00:00Z",
        "description": "Unassigned Pending 2",
        "value": 5.00,
        "owner_id": None,
        "type_id": cats_map["Outros"],
        "is_paid": False,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 150.00
    assert data["total_paid"] == 99.90
    assert data["total_pending"] == 50.10
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # All owners should have 'Sem despesas'
    for o in data["owners_summary"]:
        assert o["status"] == "Sem despesas"
        assert o["total_amount"] == 0.00
        assert o["transactions_count"] == 0

    # Category checks
    cats_summary = {c["category_name"]: c for c in data["category_summary"]}
    assert cats_summary["Mercado"]["total_amount"] == 99.90
    assert cats_summary["Lazer"]["total_amount"] == 45.10
    assert cats_summary["Outros"]["total_amount"] == 5.00


# ==============================================================================
# 4. MONTH BOUNDARY TRANSITIONS (DEC 31 23:59:59 VS JAN 01 00:00:00)
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_boundary_dec31_vs_jan01(client: AsyncClient):
    """
    Adversarial: Precision boundary test across year change:
    - Tx A: 2026-12-31T23:59:59Z (111.11) -> Must be IN 2026-12, OUT of 2027-01
    - Tx B: 2027-01-01T00:00:00Z (222.22) -> Must be IN 2027-01, OUT of 2026-12
    - Tx C: 2026-12-01T00:00:00Z (333.33) -> Must be IN 2026-12
    - Tx D: 2026-11-30T23:59:59Z (444.44) -> Must be OUT of 2026-12
    """
    # Tx A: Dec 31 23:59:59
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-12-31T23:59:59Z",
        "description": "Dec 31 Last Second",
        "value": 111.11,
    })

    # Tx B: Jan 01 00:00:00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2027-01-01T00:00:00Z",
        "description": "Jan 01 First Second",
        "value": 222.22,
    })

    # Tx C: Dec 01 00:00:00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-12-01T00:00:00Z",
        "description": "Dec 01 First Second",
        "value": 333.33,
    })

    # Tx D: Nov 30 23:59:59
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-11-30T23:59:59Z",
        "description": "Nov 30 Last Second",
        "value": 444.44,
    })

    # Query 2026-12
    dec_res = await client.get("/api/v1/dashboard/summary?month=2026-12")
    assert dec_res.status_code == 200
    dec_data = dec_res.json()

    # 2026-12 must contain exactly Tx A (111.11) and Tx C (333.33) = 444.44
    assert dec_data["total_amount"] == 444.44

    # Query 2027-01
    jan_res = await client.get("/api/v1/dashboard/summary?month=2027-01")
    assert jan_res.status_code == 200
    jan_data = jan_res.json()

    # 2027-01 must contain exactly Tx B (222.22)
    assert jan_data["total_amount"] == 222.22

    # Query 2026-11
    nov_res = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert nov_res.status_code == 200
    nov_data = nov_res.json()

    # 2026-11 must contain exactly Tx D (444.44)
    assert nov_data["total_amount"] == 444.44


@pytest.mark.asyncio
async def test_adversarial_boundary_microsecond_precision(client: AsyncClient):
    """
    Adversarial: Microsecond edge boundary (2026-12-31T23:59:59.999999Z).
    Must belong to December 2026 and NOT January 2027.
    """
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-12-31T23:59:59.999999Z",
        "description": "Microsecond edge",
        "value": 77.77,
    })

    dec = (await client.get("/api/v1/dashboard/summary?month=2026-12")).json()
    assert dec["total_amount"] == 77.77

    jan = (await client.get("/api/v1/dashboard/summary?month=2027-01")).json()
    assert jan["total_amount"] == 0.00


@pytest.mark.asyncio
async def test_adversarial_boundary_leap_year_february(client: AsyncClient):
    """
    Adversarial: Leap year 2024 boundary test:
    - 2024-02-29T23:59:59Z belongs to February 2024
    - 2024-03-01T00:00:00Z belongs to March 2024
    """
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2024-02-29T23:59:59Z",
        "description": "Leap Day Expense",
        "value": 123.45,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2024-03-01T00:00:00Z",
        "description": "March First Expense",
        "value": 678.90,
    })

    feb = (await client.get("/api/v1/dashboard/summary?month=2024-02")).json()
    assert feb["total_amount"] == 123.45

    mar = (await client.get("/api/v1/dashboard/summary?month=2024-03")).json()
    assert mar["total_amount"] == 678.90


# ==============================================================================
# 5. CARD ID QUERY PARAMETER SCENARIOS & 404 VALIDATION
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_nonexistent_card_id_404(client: AsyncClient):
    """
    Adversarial: Querying with a non-existent card ID must return HTTP 404 Not Found.
    Tested with:
    - Out of range ID (999999)
    - Zero (0)
    - Negative integer (-1)
    """
    invalid_card_ids = [999999, 0, -1, 5555]
    for cid in invalid_card_ids:
        res = await client.get(f"/api/v1/dashboard/summary?month=2026-11&card_id={cid}")
        assert res.status_code == 404, f"Expected 404 for card_id={cid}, got {res.status_code}"
        assert f"Cartão com ID {cid} não encontrado" in res.json()["detail"]


@pytest.mark.asyncio
async def test_adversarial_invalid_card_id_type_422(client: AsyncClient):
    """
    Adversarial: Passing a non-integer card_id string must be rejected
    by FastAPI parameter validation with HTTP 422 Unprocessable Entity.
    """
    invalid_types = ["abc", "null", "undefined", "12.5", "1; DROP TABLE cards_fapp;"]
    for bad in invalid_types:
        res = await client.get(f"/api/v1/dashboard/summary?month=2026-11&card_id={bad}")
        assert res.status_code == 422, f"Expected 422 for card_id='{bad}', got {res.status_code}"


@pytest.mark.asyncio
async def test_adversarial_valid_card_with_zero_expenses(client: AsyncClient):
    """
    Adversarial: A card that exists in the database but has zero transactions
    in the requested month must return 200 OK with total_amount=0.0 and all owners 'Sem despesas'.
    """
    # Create an empty card
    c_res = await client.post("/api/v1/cards", json={"card_name": "Cartão Vazio", "total_limit": 5000.0})
    assert c_res.status_code == 201
    card_id = c_res.json()["id"]

    res = await client.get(f"/api/v1/dashboard/summary?month=2026-11&card_id={card_id}")
    assert res.status_code == 200
    data = res.json()

    assert data["card_id"] == card_id
    assert data["total_amount"] == 0.0
    assert data["total_paid"] == 0.0
    assert data["total_pending"] == 0.0
    assert data["category_summary"] == []
    for o in data["owners_summary"]:
        assert o["status"] == "Sem despesas"


# ==============================================================================
# 6. INVALID MONTH QUERY PARAMETER VALIDATION
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_invalid_month_format_422(client: AsyncClient):
    r"""
    Adversarial: Month parameter must strictly match regex ^\d{4}-(0[1-9]|1[0-2])$.
    Any variation must be rejected with HTTP 422 Unprocessable Entity.
    """
    bad_months = [
        "2026-13",        # Month > 12
        "2026-00",        # Month 00
        "2026-1",         # Single digit month
        "26-11",          # Two digit year
        "2026/11",        # Slash instead of dash
        "2026-11-01",     # Full date
        "202611",         # No separator
        "",               # Empty string
        "null",           # String 'null'
        " 2026-11",       # Leading whitespace
        "2026-11 ",       # Trailing whitespace
        "2026-11\n",      # Newline (URL encoded)
        "abcd-ef",        # Non-digits
        "2026-02-29",     # Day included
    ]
    for m in bad_months:
        res = await client.get("/api/v1/dashboard/summary", params={"month": m})
        assert res.status_code == 422, f"Expected 422 for month '{m}', got {res.status_code}"

    # Missing month parameter entirely
    missing = await client.get("/api/v1/dashboard/summary")
    assert missing.status_code == 422


# ==============================================================================
# 7. FORECAST TRANSACTION ISOLATION ACROSS MULTIPLE OWNERS (RN01)
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_forecast_isolation_across_multiple_owners(client: AsyncClient):
    """
    Adversarial: Injected projected forecast transactions (is_forecast=True)
    must NEVER contaminate invoice totals, owner subtotals, or category summary.
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]

    month = "2026-09"

    # Real transaction Rafael: 100.00 (paid)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Real Rafael",
        "value": 100.00,
        "owner_id": rafael_id,
        "is_paid": True,
        "is_forecast": False,
    })

    # Forecast transaction Rafael: 999.00 (projected installment)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Forecast Rafael Parcela 2",
        "value": 999.00,
        "owner_id": rafael_id,
        "is_paid": False,
        "is_forecast": True,
    })

    # Forecast transaction Mãe: 500.00 (projected installment)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Forecast Mãe Parcela 2",
        "value": 500.00,
        "owner_id": mae_id,
        "is_paid": False,
        "is_forecast": True,
    })

    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()

    # Total must only be Rafael's 100.00; neither 999 nor 500 forecast can be included
    assert dash["total_amount"] == 100.00
    assert dash["total_paid"] == 100.00
    assert dash["total_pending"] == 0.00

    raf = next(o for o in dash["owners_summary"] if o["owner_name"] == "Rafael")
    assert raf["total_amount"] == 100.00
    assert raf["status"] == "Pago"

    mae = next(o for o in dash["owners_summary"] if o["owner_name"] == "Mãe")
    assert mae["total_amount"] == 0.00
    assert mae["status"] == "Sem despesas"
