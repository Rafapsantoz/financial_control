import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_dashboard_summary_empty_month(client: AsyncClient):
    """
    When no transactions exist in the requested month:
    - total_amount, total_paid, total_pending must be 0.0
    - owners_summary must list all seeded owners (Rafael, Mãe, Irmã) with status 'Sem despesas'
    - category_summary must be empty
    - Strict conservation: total_amount == total_paid + total_pending
    """
    res = await client.get("/api/v1/dashboard/summary?month=2026-01")
    assert res.status_code == 200
    data = res.json()

    assert data["month"] == "2026-01"
    assert data["card_id"] is None
    assert data["total_amount"] == 0.0
    assert data["total_paid"] == 0.0
    assert data["total_pending"] == 0.0
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # Check that seeded owners are present with 'Sem despesas'
    owners = {o["owner_name"]: o for o in data["owners_summary"]}
    assert "Rafael" in owners
    assert "Mãe" in owners
    assert "Irmã" in owners

    for name, o in owners.items():
        assert o["status"] == "Sem despesas"
        assert o["total_amount"] == 0.0
        assert o["paid_amount"] == 0.0
        assert o["pending_amount"] == 0.0
        assert o["transactions_count"] == 0

    assert data["category_summary"] == []


@pytest.mark.asyncio
async def test_family_rateio_distribution_and_statuses(client: AsyncClient):
    """
    Tests family rateio distribution with distinct statuses for Rafael, Mãe, and Irmã:
    - Rafael: 2 transactions, both paid (is_paid=True) -> status: "Pago"
    - Mãe: 2 transactions, neither paid (is_paid=False) -> status: "Pendente"
    - Irmã: 2 transactions, 1 paid and 1 unpaid -> status: "Parcial"
    - Verifies strict value conservation for each owner and invoice total
    """
    # Fetch seeded owners
    owners_res = await client.get("/api/v1/owners")
    assert owners_res.status_code == 200
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}

    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]
    irma_id = owners_map["Irmã"]

    month = "2026-11"

    # Rafael: 120.50 (paid) + 79.50 (paid) = 200.00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T10:00:00Z",
        "description": "Tech Store Rafael",
        "value": 120.50,
        "owner_id": rafael_id,
        "is_paid": True,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T14:30:00Z",
        "description": "Steam Games Rafael",
        "value": 79.50,
        "owner_id": rafael_id,
        "is_paid": True,
    })

    # Mãe: 150.00 (unpaid) + 50.00 (unpaid) = 200.00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-12T09:15:00Z",
        "description": "Drogaria Mãe",
        "value": 150.00,
        "owner_id": mae_id,
        "is_paid": False,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-15T16:00:00Z",
        "description": "Supermercado Mãe",
        "value": 50.00,
        "owner_id": mae_id,
        "is_paid": False,
    })

    # Irmã: 100.00 (paid) + 150.00 (unpaid) = 250.00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-18T11:20:00Z",
        "description": "Zara Irmã",
        "value": 100.00,
        "owner_id": irma_id,
        "is_paid": True,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-20T18:45:00Z",
        "description": "Sephora Irmã",
        "value": 150.00,
        "owner_id": irma_id,
        "is_paid": False,
    })

    # Query dashboard summary
    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    # Invoice totals check
    expected_total = 650.00
    expected_paid = 300.00  # 120.50 + 79.50 + 100.00
    expected_pending = 350.00  # 150.00 + 50.00 + 150.00

    assert data["total_amount"] == expected_total
    assert data["total_paid"] == expected_paid
    assert data["total_pending"] == expected_pending
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # Individual owner checks
    owners_summary = {o["owner_name"]: o for o in data["owners_summary"]}

    # Rafael -> Pago
    raf = owners_summary["Rafael"]
    assert raf["status"] == "Pago"
    assert raf["total_amount"] == 200.00
    assert raf["paid_amount"] == 200.00
    assert raf["pending_amount"] == 0.00
    assert raf["transactions_count"] == 2
    assert raf["total_amount"] == round(raf["paid_amount"] + raf["pending_amount"], 2)

    # Mãe -> Pendente
    mae = owners_summary["Mãe"]
    assert mae["status"] == "Pendente"
    assert mae["total_amount"] == 200.00
    assert mae["paid_amount"] == 0.00
    assert mae["pending_amount"] == 200.00
    assert mae["transactions_count"] == 2
    assert mae["total_amount"] == round(mae["paid_amount"] + mae["pending_amount"], 2)

    # Irmã -> Parcial
    irma = owners_summary["Irmã"]
    assert irma["status"] == "Parcial"
    assert irma["total_amount"] == 250.00
    assert irma["paid_amount"] == 100.00
    assert irma["pending_amount"] == 150.00
    assert irma["transactions_count"] == 2
    assert irma["total_amount"] == round(irma["paid_amount"] + irma["pending_amount"], 2)


@pytest.mark.asyncio
async def test_toggle_paid_immediate_reflection_on_dashboard(client: AsyncClient):
    """
    Tests that toggling a transaction's is_paid status via PATCH
    immediately reflects on the dashboard summary and transitions statuses:
    1. Create transaction with is_paid=False -> status: 'Pendente'
    2. Toggle paid -> status becomes 'Pago'
    3. Toggle paid again -> status returns to 'Pendente'
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    mae_id = owners_map["Mãe"]

    month = "2026-08"

    # Step 1: Create unpaid transaction
    create_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-14T12:00:00Z",
        "description": "Farmácia São Paulo",
        "value": 350.00,
        "owner_id": mae_id,
        "is_paid": False,
    })
    assert create_res.status_code == 201
    tx_id = create_res.json()["id"]

    # Verify initial dashboard state: Pendente
    dash1 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    mae_summary1 = next(o for o in dash1["owners_summary"] if o["owner_name"] == "Mãe")
    assert mae_summary1["status"] == "Pendente"
    assert mae_summary1["paid_amount"] == 0.00
    assert mae_summary1["pending_amount"] == 350.00
    assert dash1["total_paid"] == 0.00
    assert dash1["total_pending"] == 350.00

    # Step 2: Toggle payment status -> True
    toggle_res = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_paid"] is True

    # Verify immediate dashboard reflection: Pago
    dash2 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    mae_summary2 = next(o for o in dash2["owners_summary"] if o["owner_name"] == "Mãe")
    assert mae_summary2["status"] == "Pago"
    assert mae_summary2["paid_amount"] == 350.00
    assert mae_summary2["pending_amount"] == 0.00
    assert dash2["total_paid"] == 350.00
    assert dash2["total_pending"] == 0.00

    # Step 3: Toggle payment status back -> False
    toggle_res2 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["is_paid"] is False

    # Verify reversion: Pendente
    dash3 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    mae_summary3 = next(o for o in dash3["owners_summary"] if o["owner_name"] == "Mãe")
    assert mae_summary3["status"] == "Pendente"
    assert mae_summary3["paid_amount"] == 0.00
    assert mae_summary3["pending_amount"] == 350.00


@pytest.mark.asyncio
async def test_category_breakdown_and_percentages(client: AsyncClient):
    """
    Tests category breakdown and proportionate percentage calculation:
    - 3 categories: Mercado (500), Farmácia (300), Lazer (200) -> total 1000
    - Percentages: Mercado (50.0%), Farmácia (30.0%), Lazer (20.0%)
    - Sorted descending by total_amount
    """
    cats_res = await client.get("/api/v1/categories")
    cats_map = {c["description"]: c["id"] for c in cats_res.json()}

    mercado_id = cats_map["Mercado"]
    farmacia_id = cats_map["Farmácia"]
    lazer_id = cats_map["Lazer"]

    month = "2026-07"

    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-02T10:00:00Z",
        "description": "Supermercado Pão de Açúcar",
        "value": 500.00,
        "type_id": mercado_id,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T11:00:00Z",
        "description": "Droga Raia",
        "value": 300.00,
        "type_id": farmacia_id,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-15T20:00:00Z",
        "description": "Cinema e Lazer",
        "value": 200.00,
        "type_id": lazer_id,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 1000.00
    cat_summary = data["category_summary"]
    assert len(cat_summary) == 3

    # Check order: sorted descending by total_amount
    assert cat_summary[0]["category_name"] == "Mercado"
    assert cat_summary[0]["total_amount"] == 500.00
    assert cat_summary[0]["percentage"] == 50.00

    assert cat_summary[1]["category_name"] == "Farmácia"
    assert cat_summary[1]["total_amount"] == 300.00
    assert cat_summary[1]["percentage"] == 30.00

    assert cat_summary[2]["category_name"] == "Lazer"
    assert cat_summary[2]["total_amount"] == 200.00
    assert cat_summary[2]["percentage"] == 20.00

    # Sum of percentages
    assert round(sum(c["percentage"] for c in cat_summary), 2) == 100.00


@pytest.mark.asyncio
async def test_forecast_transactions_ignored_in_current_month(client: AsyncClient):
    """
    Business Rule: Future forecast transactions (is_forecast == True)
    must be strictly ignored in current month closing calculations.
    """
    month = "2026-09"

    # Regular non-forecast transaction: 150.00
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Compra Real Mês Atual",
        "value": 150.00,
        "is_forecast": False,
    })

    # Forecast transaction: 350.00 (projected installment)
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Parcela Projetada Futura",
        "value": 350.00,
        "is_forecast": True,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    # Only 150.00 should be accounted for; 350.00 forecast must be omitted
    assert data["total_amount"] == 150.00
    assert data["total_pending"] == 150.00
    assert data["total_paid"] == 0.00


@pytest.mark.asyncio
async def test_card_filter_isolation(client: AsyncClient):
    """
    Tests filtering dashboard summary by card_id:
    - Card 1 (Nubank): 200.00
    - Card 2 (Inter): 450.00
    - Without card filter: 650.00
    - card_id=1: 200.00
    - card_id=2: 450.00
    - card_id=99999 (non-existent): 404 Not Found
    """
    # Create second card
    card2_res = await client.post("/api/v1/cards", json={"card_name": "Inter Black", "total_limit": 10000.0})
    assert card2_res.status_code == 201
    card2_id = card2_res.json()["id"]

    cards_res = await client.get("/api/v1/cards")
    card1_id = next(c["id"] for c in cards_res.json() if c["card_name"] == "Nubank")

    month = "2026-10"

    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-04T10:00:00Z",
        "description": "Nubank Expense",
        "value": 200.00,
        "card_id": card1_id,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-08T15:00:00Z",
        "description": "Inter Expense",
        "value": 450.00,
        "card_id": card2_id,
    })

    # Summary without card filter
    all_cards_res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert all_cards_res.status_code == 200
    assert all_cards_res.json()["total_amount"] == 650.00
    assert all_cards_res.json()["card_id"] is None

    # Summary for Card 1
    c1_res = await client.get(f"/api/v1/dashboard/summary?month={month}&card_id={card1_id}")
    assert c1_res.status_code == 200
    assert c1_res.json()["total_amount"] == 200.00
    assert c1_res.json()["card_id"] == card1_id

    # Summary for Card 2
    c2_res = await client.get(f"/api/v1/dashboard/summary?month={month}&card_id={card2_id}")
    assert c2_res.status_code == 200
    assert c2_res.json()["total_amount"] == 450.00
    assert c2_res.json()["card_id"] == card2_id

    # Non-existent card
    c_bad = await client.get(f"/api/v1/dashboard/summary?month={month}&card_id=99999")
    assert c_bad.status_code == 404
    assert "não encontrado" in c_bad.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_month_format_validation(client: AsyncClient):
    r"""
    Query parameter month must strictly conform to regex ^\d{4}-(0[1-9]|1[0-2])$:
    - Invalid formats must return 422 Unprocessable Entity
    """
    invalid_months = [
        "2026-13",
        "2026-00",
        "2026/11",
        "2026-1",
        "invalid",
        "2026-11-04",
        "202611",
    ]
    for bad_month in invalid_months:
        res = await client.get(f"/api/v1/dashboard/summary?month={bad_month}")
        assert res.status_code == 422, f"Expected 422 for month '{bad_month}', got {res.status_code}"

    # Missing month parameter
    missing_res = await client.get("/api/v1/dashboard/summary")
    assert missing_res.status_code == 422


@pytest.mark.asyncio
async def test_strict_conservation_with_floating_point_numbers(client: AsyncClient):
    """
    Tests strict value conservation with tricky float cents:
    - total_amount == total_paid + total_pending
    - owner total == owner paid + owner pending
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]

    month = "2026-06"

    # Series of float cents
    values = [19.99, 33.33, 49.99, 10.05, 7.87, 0.99]
    for i, val in enumerate(values):
        await client.post("/api/v1/transactions", json={
            "dt_lcto": f"{month}-0{i+1}T10:00:00Z",
            "description": f"Float Tx {i}",
            "value": val,
            "owner_id": rafael_id if i % 2 == 0 else mae_id,
            "is_paid": (i % 3 == 0),
        })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    # Invoice level strict conservation
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    # Owner level strict conservation
    for o in data["owners_summary"]:
        assert o["total_amount"] == round(o["paid_amount"] + o["pending_amount"], 2)


@pytest.mark.asyncio
async def test_date_boundaries_for_month(client: AsyncClient):
    """
    Transactions on the first and last second of a month are included,
    while transactions in adjacent months are excluded.
    """
    month = "2026-05"

    # First moment of May: 2026-05-01T00:00:00Z -> IN
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-05-01T00:00:00Z",
        "description": "May Start",
        "value": 100.00,
    })

    # Last moment of May: 2026-05-31T23:59:59Z -> IN
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-05-31T23:59:59Z",
        "description": "May End",
        "value": 200.00,
    })

    # Preceding month: 2026-04-30T23:59:59Z -> OUT
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-04-30T23:59:59Z",
        "description": "April End",
        "value": 500.00,
    })

    # Succeeding month: 2026-06-01T00:00:00Z -> OUT
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-06-01T00:00:00Z",
        "description": "June Start",
        "value": 500.00,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 300.00  # 100.00 + 200.00


@pytest.mark.asyncio
async def test_december_year_rollover_boundaries(client: AsyncClient):
    """
    Ensures that month=YYYY-12 correctly wraps around to YYYY+1-01-01
    and excludes January of the next year.
    """
    month = "2026-12"

    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-12-15T10:00:00Z",
        "description": "Christmas Shopping",
        "value": 450.00,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-12-31T23:59:59Z",
        "description": "New Year's Eve Dinner",
        "value": 350.00,
    })
    await client.post("/api/v1/transactions", json={
        "dt_lcto": "2027-01-01T00:00:00Z",
        "description": "Next Year New Year",
        "value": 900.00,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 800.00  # 450.00 + 350.00, 900.00 excluded


@pytest.mark.asyncio
async def test_unassigned_and_uncategorized_transactions_graceful_handling(client: AsyncClient):
    """
    Transactions with owner_id=None or type_id=None:
    - Must be included in invoice totals (total_amount, total_paid, total_pending)
    - Uncategorized transactions fallback to 'Outros' in category breakdown
    - Unassigned transactions must not corrupt per-owner summaries
    """
    month = "2026-04"

    # Transaction with no owner and no category
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T12:00:00Z",
        "description": "Anonymous Purchase",
        "value": 250.00,
        "owner_id": None,
        "type_id": None,
        "is_paid": True,
    })

    res = await client.get(f"/api/v1/dashboard/summary?month={month}")
    assert res.status_code == 200
    data = res.json()

    assert data["total_amount"] == 250.00
    assert data["total_paid"] == 250.00
    assert data["total_pending"] == 0.00

    # Owners should all still be 'Sem despesas' since none had assigned transactions
    for o in data["owners_summary"]:
        assert o["status"] == "Sem despesas"
        assert o["total_amount"] == 0.00

    # Category fallback to 'Outros'
    assert len(data["category_summary"]) == 1
    assert data["category_summary"][0]["category_name"] == "Outros"
    assert data["category_summary"][0]["total_amount"] == 250.00
    assert data["category_summary"][0]["percentage"] == 100.00


@pytest.mark.asyncio
async def test_dashboard_reflects_transaction_update_and_deletion(client: AsyncClient):
    """
    Dashboard calculations must be real-time and dynamically reflect:
    - Transaction value update
    - Transaction deletion
    """
    month = "2026-03"

    create_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Initial Tx",
        "value": 100.00,
        "is_paid": False,
    })
    tx_id = create_res.json()["id"]

    # Verify initial summary
    dash1 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    assert dash1["total_amount"] == 100.00
    assert dash1["total_pending"] == 100.00

    # Update value from 100.00 to 250.00
    up_res = await client.put(f"/api/v1/transactions/{tx_id}", json={"value": 250.00})
    assert up_res.status_code == 200

    dash2 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    assert dash2["total_amount"] == 250.00
    assert dash2["total_pending"] == 250.00

    # Delete transaction
    del_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 200

    dash3 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    assert dash3["total_amount"] == 0.00
    assert dash3["total_pending"] == 0.00


@pytest.mark.asyncio
async def test_forecast_and_consolidated_liquid_separation(client: AsyncClient):
    """
    Tests the separation between Total Consolidado (with forecasts) and Total Líquido (effective only):
    - Confirmed purchase: R$ 200.00 (is_forecast=False)
    - Estimated bill (luz/água/imposto): R$ 150.00 (is_forecast=True)
    - Expected:
      total_effective == 200.00 (Total Líquido)
      total_forecast == 150.00 (Total Previsto)
      total_consolidated == 350.00 (Total Consolidado)
    - When confirmed with real bill: is_forecast toggled to False -> total_effective becomes 350.00
    """
    month = "2026-11"

    # 1. Post effective transaction
    await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-05T12:00:00Z",
        "description": "Supermercado Semanal",
        "value": 200.00,
        "is_forecast": False,
    })

    # 2. Post forecasted estimated bill
    f_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-10T12:00:00Z",
        "description": "Conta de Luz (Previsto)",
        "value": 150.00,
        "is_forecast": True,
    })
    forecast_id = f_res.json()["id"]

    # 3. Verify separation in dashboard summary
    dash = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    assert dash["total_effective"] == 200.00
    assert dash["total_forecast"] == 150.00
    assert dash["total_consolidated"] == 350.00
    assert dash["total_amount"] == 200.00

    # 4. Update the bill when actual invoice arrives (e.g., luz veio R$ 160.00) and uncheck is_forecast
    await client.put(f"/api/v1/transactions/{forecast_id}", json={
        "value": 160.00,
        "is_forecast": False,
        "description": "Conta de Luz (Fechada)",
    })

    dash2 = (await client.get(f"/api/v1/dashboard/summary?month={month}")).json()
    assert dash2["total_effective"] == 360.00
    assert dash2["total_forecast"] == 0.00
    assert dash2["total_consolidated"] == 360.00
    assert dash2["total_amount"] == 360.00


@pytest.mark.asyncio
async def test_transaction_split(client: AsyncClient):
    """
    Tests splitting a transaction into multiple child transactions across owners:
    - Original: R$ 140.00 assigned to Irmã
    - Split: R$ 70.00 to Irmã, R$ 70.00 to Rafael
    - Verifies original is updated to 70.00 and a new transaction is created for Rafael with 70.00
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    irma_id = owners_map["Irmã"]
    rafael_id = owners_map["Rafael"]

    # 1. Create original transaction
    create_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-11-10T12:00:00Z",
        "description": "VITTORIADASILVPARC01/02",
        "value": 140.00,
        "owner_id": irma_id,
        "cur_parcs": 1,
        "total_parcs": 2,
    })
    assert create_res.status_code == 201
    orig_id = create_res.json()["id"]

    # 2. Split transaction
    split_res = await client.post(f"/api/v1/transactions/{orig_id}/split", json={
        "splits": [
            {"owner_id": irma_id, "amount": 70.00, "note": "Parte Irmã"},
            {"owner_id": rafael_id, "amount": 70.00, "note": "Parte Rafael"}
        ]
    })
    assert split_res.status_code == 200
    split_data = split_res.json()
    assert len(split_data) == 2

    # Check that original is updated to 70.00
    orig_tx = (await client.get(f"/api/v1/transactions/{orig_id}")).json()
    assert orig_tx["value"] == 70.00
    assert orig_tx["owner_id"] == irma_id

    # Check child tx
    new_tx_id = [t["id"] for t in split_data if t["id"] != orig_id][0]
    child_tx = (await client.get(f"/api/v1/transactions/{new_tx_id}")).json()
    assert child_tx["value"] == 70.00
    assert child_tx["owner_id"] == rafael_id


@pytest.mark.asyncio
async def test_replicate_installments(client: AsyncClient):
    """
    Tests automatic replication of remaining installments for future months:
    - Given parcel 1/3 in 2026-11
    - Replicates parcel 2/3 in 2026-12 and 3/3 in 2027-01
    """
    create_res = await client.post("/api/v1/transactions", json={
        "dt_lcto": "2026-11-05T10:00:00Z",
        "invoice_month": "2026-11",
        "description": "Curso Online",
        "value": 50.00,
        "cur_parcs": 1,
        "total_parcs": 3,
    })
    assert create_res.status_code == 201
    tx_id = create_res.json()["id"]

    rep_res = await client.post(f"/api/v1/transactions/{tx_id}/replicate-installments", json={
        "generate_future": True,
        "generate_past": False
    })
    assert rep_res.status_code == 201
    replicated = rep_res.json()
    assert len(replicated) == 2

    # Verify months and installment numbers
    p2 = [t for t in replicated if t["cur_parcs"] == 2][0]
    p3 = [t for t in replicated if t["cur_parcs"] == 3][0]

    assert p2["invoice_month"] == "2026-12"
    assert p2["value"] == 50.00
    assert p3["invoice_month"] == "2027-01"
    assert p3["value"] == 50.00


@pytest.mark.asyncio
async def test_owner_settle_cascade(client: AsyncClient):
    """
    Tests cascading debt settlement for an owner:
    - Mãe has 3 unpaid bills: 100.00, 40.00, 30.00 (total: 170.00)
    - She pays 150.00
    - Cascade orders by ascending value:
      - Bill 3 (30.00): fully paid (remaining: 120.00)
      - Bill 2 (40.00): fully paid (remaining: 80.00)
      - Bill 1 (100.00): split into 80.00 (paid) and 20.00 (pending)
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    mae_id = owners_map["Mãe"]

    month = "2026-10"

    t1 = (await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-01T10:00:00Z",
        "description": "Conta A",
        "value": 100.00,
        "owner_id": mae_id,
        "is_paid": False
    })).json()

    t2 = (await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-02T10:00:00Z",
        "description": "Conta B",
        "value": 40.00,
        "owner_id": mae_id,
        "is_paid": False
    })).json()

    t3 = (await client.post("/api/v1/transactions", json={
        "dt_lcto": f"{month}-03T10:00:00Z",
        "description": "Conta C",
        "value": 30.00,
        "owner_id": mae_id,
        "is_paid": False
    })).json()

    settle_res = await client.post(f"/api/v1/owners/{mae_id}/settle", json={
        "month": month,
        "payment_amount": 150.00
    })
    assert settle_res.status_code == 200
    data = settle_res.json()

    assert data["settled_amount"] == 150.00
    assert data["fully_settled_count"] == 2
    assert data["partially_settled_count"] == 1
    assert data["remaining_pending"] == 20.00

    # Verify database state
    t1_check = (await client.get(f"/api/v1/transactions/{t1['id']}")).json()
    t2_check = (await client.get(f"/api/v1/transactions/{t2['id']}")).json()
    t3_check = (await client.get(f"/api/v1/transactions/{t3['id']}")).json()

    assert t3_check["is_paid"] is True
    assert t3_check["value"] == 30.00
    assert t2_check["is_paid"] is True
    assert t2_check["value"] == 40.00
    assert t1_check["is_paid"] is True
    assert t1_check["value"] == 80.00


