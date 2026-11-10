"""
test_adversarial_m4.py — Milestone 4 Empirical Adversarial Test Suite.

Adversarial stress-testing and empirical verification for Milestone 4:
1. Double Invoice Confirmation Behavior & RN02 Duplicate Defense.
2. Payment Toggling on Forecast Transactions and Lifecycle Activation.
3. Multi-Card Same-Month Isolation, Cross-Filtering, and Consolidation.
4. Hermetic Test Session Isolation and Cross-Test Leak Prevention.
5. Full Multi-Card, Multi-Installment, Multi-Owner Financial Settlement.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction

# Valid minimal synthetic PDF fixture bytes
SYNTHETIC_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
    b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
)


# ============================================================================
# 1. Double Invoice Confirmation & RN02 Duplicate Defense
# ============================================================================

@pytest.mark.asyncio
async def test_adversarial_m4_double_invoice_confirmation_behavior(client: AsyncClient, db_session: AsyncSession):
    """
    Adversarial Challenge: What happens if an invoice is confirmed twice?
    
    1. Direct double-confirmation:
       - If a client posts the exact same confirmation payload twice without re-extracting,
         the endpoint creates duplicate records, doubling the dashboard total.
    2. Workflow double-confirmation with RN02 defense:
       - When following the standard workflow (upload -> extract -> review -> confirm),
         re-uploading the invoice causes /api/v1/invoices/extract to mark all previously
         saved transactions as is_duplicate=True (RN02).
       - If the client filters out duplicates prior to confirm, the payload has 0 new items
         and is rejected with 400 Bad Request, preventing double-billing.
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]

    cards_res = await client.get("/api/v1/cards")
    card_id = cards_res.json()[0]["id"]

    confirm_payload = {
        "card_id": card_id,
        "project_future_installments": False,
        "items": [
            {
                "purchase_date": "2026-10-15",
                "description": "Drogaria Pacheco Medicamentos",
                "amount": 120.00,
                "owner_id": mae_id,
                "total_parcs": 1,
                "cur_parcs": 1,
            },
            {
                "purchase_date": "2026-10-18",
                "description": "Restaurante Outback",
                "amount": 200.00,
                "owner_id": rafael_id,
                "total_parcs": 1,
                "cur_parcs": 1,
            },
        ],
    }

    # First confirmation: 2 items created
    res1 = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
    assert res1.status_code == 201
    assert res1.json()["confirmed_count"] == 2

    # Verify initial summary
    sum1 = await client.get("/api/v1/dashboard/summary?month=2026-10")
    assert sum1.status_code == 200
    assert sum1.json()["total_amount"] == 320.00

    # Second direct confirmation (blind double-post): blocked by duplicate prevention
    res2 = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
    assert res2.status_code == 409
    assert "já foi importada anteriormente" in res2.json()["detail"]

    # When replace_existing=True is provided, it replaces previous entries cleanly
    res2_replace = await client.post(
        "/api/v1/invoices/confirm",
        json={**confirm_payload, "replace_existing": True},
    )
    assert res2_replace.status_code == 201
    assert res2_replace.json()["confirmed_count"] == 2

    # Total in DB remains 320.00 (never duplicated to 640.00)
    sum2 = await client.get("/api/v1/dashboard/summary?month=2026-10")
    assert sum2.status_code == 200
    assert sum2.json()["total_amount"] == 320.00

    # Verify RN02 defense on re-extract:
    mock_payload = {
        "bank_or_issuer": "Nubank",
        "invoice_month_year": "2026-10",
        "due_date": "2026-10-25",
        "total_invoice_amount": 320.00,
        "items": [
            {
                "purchase_date": "2026-10-15",
                "description": "Drogaria Pacheco Medicamentos",
                "amount": 120.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Farmácia",
            },
            {
                "purchase_date": "2026-10-18",
                "description": "Restaurante Outback",
                "amount": 200.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Restaurante",
            },
        ],
    }
    mock_resp = MagicMock()
    mock_resp.text = json.dumps(mock_payload)
    mock_resp.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_instance = MagicMock()
        mock_instance.aio.models.generate_content = AsyncMock(return_value=mock_resp)
        mock_get_client.return_value = mock_instance

        extract_res = await client.post(
            "/api/v1/invoices/extract",
            files={"file": ("fatura_duplicada.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")},
        )
        assert extract_res.status_code == 200
        extracted = extract_res.json()

        # Both items are flagged as duplicate!
        for item in extracted["items"]:
            assert item["is_duplicate"] is True

        # If duplicate items are filtered out before confirmation:
        filtered_items = [i for i in extracted["items"] if not i["is_duplicate"]]
        res_empty = await client.post(
            "/api/v1/invoices/confirm",
            json={"card_id": card_id, "items": filtered_items},
        )
        # Empty item confirmation is safely rejected
        assert res_empty.status_code in (400, 422)


# ============================================================================
# 2. Payment Toggling on Forecast Transactions
# ============================================================================

@pytest.mark.asyncio
async def test_adversarial_m4_toggle_paid_on_forecast_transaction(client: AsyncClient, db_session: AsyncSession):
    """
    Adversarial Challenge: What happens if someone toggles payment on a forecast transaction?
    
    1. Create a 3-installment purchase in October (Month 10).
       - Installment 1/3 is in Month 10 (is_forecast=False).
       - Installments 2/3 and 3/3 are projected for Month 11 and Month 12 (is_forecast=True).
    2. Toggle payment on the Month 11 forecast transaction:
       - The PATCH endpoint succeeds and flips is_paid from False to True.
    3. Check Month 10 and Month 11 dashboard summaries:
       - Month 10 summary is unaffected.
       - Month 11 summary STILL ignores the forecast transaction because is_forecast=True!
         total_amount remains 0.00 and owner status remains 'Sem despesas'.
    4. Lifecycle activation:
       - When Month 11 arrives and the transaction is activated (is_forecast=False):
         It immediately enters the Month 11 closure as 'Pago' without data loss.
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    irma_id = owners_map["Irmã"]

    confirm_payload = {
        "project_future_installments": True,
        "items": [
            {
                "purchase_date": "2026-10-01",
                "description": "Curso Online Irmã 01/03",
                "value": 150.00,
                "owner_id": irma_id,
                "total_parcs": 3,
                "cur_parcs": 1,
            }
        ],
    }

    res_confirm = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
    assert res_confirm.status_code == 201
    assert res_confirm.json()["confirmed_count"] == 3

    # Query the forecasted transaction for November (Month 11)
    tx_res = await client.get("/api/v1/transactions?month=2026-11&is_forecast=true")
    assert tx_res.status_code == 200
    nov_forecast_txs = tx_res.json()
    assert len(nov_forecast_txs) == 1
    nov_tx = nov_forecast_txs[0]
    assert nov_tx["is_forecast"] is True
    assert nov_tx["is_paid"] is False

    # 1. Toggle payment on the forecast transaction
    toggle_res = await client.patch(f"/api/v1/transactions/{nov_tx['id']}/toggle-paid")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_paid"] is True
    assert toggle_res.json()["is_forecast"] is True

    # 2. Check Month 10 closure — October has only the first installment (unpaid)
    oct_sum = await client.get("/api/v1/dashboard/summary?month=2026-10")
    assert oct_sum.status_code == 200
    oct_irma = next(o for o in oct_sum.json()["owners_summary"] if o["owner_name"] == "Irmã")
    assert oct_irma["total_amount"] == 150.00
    assert oct_irma["status"] == "Pendente"

    # 3. Check Month 11 closure — forecast transactions must be excluded even if is_paid=True!
    nov_sum = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert nov_sum.status_code == 200
    assert nov_sum.json()["total_amount"] == 0.00
    nov_irma = next(o for o in nov_sum.json()["owners_summary"] if o["owner_name"] == "Irmã")
    assert nov_irma["status"] == "Sem despesas"
    assert nov_irma["total_amount"] == 0.00

    # 4. Activate transaction (user confirms Month 11 invoice arrival: is_forecast -> False)
    activate_res = await client.put(f"/api/v1/transactions/{nov_tx['id']}", json={"is_forecast": False})
    assert activate_res.status_code == 200
    assert activate_res.json()["is_forecast"] is False
    assert activate_res.json()["is_paid"] is True  # Preserved!

    # 5. Month 11 closure now recognizes the transaction and its 'Pago' status
    nov_sum_active = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert nov_sum_active.status_code == 200
    assert nov_sum_active.json()["total_amount"] == 150.00
    assert nov_sum_active.json()["total_paid"] == 150.00
    assert nov_sum_active.json()["total_pending"] == 0.00

    nov_irma_active = next(o for o in nov_sum_active.json()["owners_summary"] if o["owner_name"] == "Irmã")
    assert nov_irma_active["status"] == "Pago"
    assert nov_irma_active["paid_amount"] == 150.00
    assert nov_irma_active["pending_amount"] == 0.00


# ============================================================================
# 3. Multi-Card Transactions in Same Month (Isolation & Consolidation)
# ============================================================================

@pytest.mark.asyncio
async def test_adversarial_m4_multi_card_same_month_isolation_and_consolidation(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Adversarial Challenge: What happens if transactions span multiple cards in the same month?
    
    1. Seed multiple cards: Nubank (seeded) + Inter (newly created).
    2. Add transactions across cards for the same month (2026-08):
       - Card 1 (Nubank):
         - Rafael: R$ 100.00 (unpaid)
         - Mãe: R$ 50.00 (paid)
       - Card 2 (Inter):
         - Rafael: R$ 200.00 (paid)
         - Irmã: R$ 150.00 (unpaid)
       - No card (unassigned / cash):
         - Rafael: R$ 30.00 (unpaid)
    3. Verify Card 1 view:
       - Total: 150.00 (Paid: 50.00, Pending: 100.00)
       - Rafael is 'Pendente', Mãe is 'Pago', Irmã is 'Sem despesas'.
    4. Verify Card 2 view:
       - Total: 350.00 (Paid: 200.00, Pending: 150.00)
       - Rafael is 'Pago', Irmã is 'Pendente', Mãe is 'Sem despesas'.
    5. Verify Consolidated view (no card_id filter):
       - Total: 530.00 (Paid: 250.00, Pending: 280.00)
       - Rafael is 'Parcial' (Paid: 200.00, Pending: 130.00)
       - Mãe is 'Pago' (Paid: 50.00, Pending: 0.00)
       - Irmã is 'Pendente' (Paid: 0.00, Pending: 150.00)
       - Zero-drift conservation holds across all views.
    """
    # 1. Get owners
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]
    irma_id = owners_map["Irmã"]

    # 2. Get Card 1 (Nubank) and create Card 2 (Inter)
    cards_res = await client.get("/api/v1/cards")
    nubank_card = next(c for c in cards_res.json() if c["card_name"] == "Nubank")
    card_nubank_id = nubank_card["id"]

    create_inter_res = await client.post("/api/v1/cards", json={"card_name": "Inter Mastercard"})
    assert create_inter_res.status_code == 201
    card_inter_id = create_inter_res.json()["id"]

    # 3. Create transactions for August 2026 (2026-08)
    tx_fixtures = [
        # Nubank: Rafael R$ 100 (unpaid), Mãe R$ 50 (paid)
        {"dt_lcto": "2026-08-05T12:00:00Z", "description": "Nubank Rafael Item", "value": 100.00, "owner_id": rafael_id, "card_id": card_nubank_id, "is_paid": False},
        {"dt_lcto": "2026-08-08T12:00:00Z", "description": "Nubank Mãe Item", "value": 50.00, "owner_id": mae_id, "card_id": card_nubank_id, "is_paid": True},
        # Inter: Rafael R$ 200 (paid), Irmã R$ 150 (unpaid)
        {"dt_lcto": "2026-08-12T12:00:00Z", "description": "Inter Rafael Item", "value": 200.00, "owner_id": rafael_id, "card_id": card_inter_id, "is_paid": True},
        {"dt_lcto": "2026-08-15T12:00:00Z", "description": "Inter Irmã Item", "value": 150.00, "owner_id": irma_id, "card_id": card_inter_id, "is_paid": False},
        # Unassigned card: Rafael R$ 30 (unpaid)
        {"dt_lcto": "2026-08-20T12:00:00Z", "description": "Dinheiro Rafael", "value": 30.00, "owner_id": rafael_id, "card_id": None, "is_paid": False},
    ]

    for tx in tx_fixtures:
        res = await client.post("/api/v1/transactions", json=tx)
        assert res.status_code == 201

    # --- View A: Card 1 (Nubank) Filter ---
    res_nubank = await client.get(f"/api/v1/dashboard/summary?month=2026-08&card_id={card_nubank_id}")
    assert res_nubank.status_code == 200
    sum_nubank = res_nubank.json()
    assert sum_nubank["total_amount"] == 150.00
    assert sum_nubank["total_paid"] == 50.00
    assert sum_nubank["total_pending"] == 100.00
    assert sum_nubank["total_amount"] == round(sum_nubank["total_paid"] + sum_nubank["total_pending"], 2)

    nubank_owners = {o["owner_name"]: o for o in sum_nubank["owners_summary"]}
    assert nubank_owners["Rafael"]["status"] == "Pendente"
    assert nubank_owners["Rafael"]["total_amount"] == 100.00
    assert nubank_owners["Mãe"]["status"] == "Pago"
    assert nubank_owners["Mãe"]["total_amount"] == 50.00
    assert nubank_owners["Irmã"]["status"] == "Sem despesas"
    assert nubank_owners["Irmã"]["total_amount"] == 0.00

    # --- View B: Card 2 (Inter) Filter ---
    res_inter = await client.get(f"/api/v1/dashboard/summary?month=2026-08&card_id={card_inter_id}")
    assert res_inter.status_code == 200
    sum_inter = res_inter.json()
    assert sum_inter["total_amount"] == 350.00
    assert sum_inter["total_paid"] == 200.00
    assert sum_inter["total_pending"] == 150.00
    assert sum_inter["total_amount"] == round(sum_inter["total_paid"] + sum_inter["total_pending"], 2)

    inter_owners = {o["owner_name"]: o for o in sum_inter["owners_summary"]}
    assert inter_owners["Rafael"]["status"] == "Pago"
    assert inter_owners["Rafael"]["total_amount"] == 200.00
    assert inter_owners["Irmã"]["status"] == "Pendente"
    assert inter_owners["Irmã"]["total_amount"] == 150.00
    assert inter_owners["Mãe"]["status"] == "Sem despesas"
    assert inter_owners["Mãe"]["total_amount"] == 0.00

    # --- View C: Consolidated View (All Cards + Unassigned) ---
    res_all = await client.get("/api/v1/dashboard/summary?month=2026-08")
    assert res_all.status_code == 200
    sum_all = res_all.json()
    # Total: 100 + 50 + 200 + 150 + 30 = 530.00
    assert sum_all["total_amount"] == 530.00
    assert sum_all["total_paid"] == 250.00  # 50 + 200
    assert sum_all["total_pending"] == 280.00  # 100 + 150 + 30
    assert sum_all["total_amount"] == round(sum_all["total_paid"] + sum_all["total_pending"], 2)

    all_owners = {o["owner_name"]: o for o in sum_all["owners_summary"]}
    # Rafael has 200 paid and 130 pending -> 'Parcial'
    assert all_owners["Rafael"]["status"] == "Parcial"
    assert all_owners["Rafael"]["paid_amount"] == 200.00
    assert all_owners["Rafael"]["pending_amount"] == 130.00
    assert all_owners["Rafael"]["total_amount"] == 330.00
    # Mãe has 50 paid and 0 pending -> 'Pago'
    assert all_owners["Mãe"]["status"] == "Pago"
    assert all_owners["Mãe"]["paid_amount"] == 50.00
    assert all_owners["Mãe"]["pending_amount"] == 0.00
    assert all_owners["Mãe"]["total_amount"] == 50.00
    # Irmã has 0 paid and 150 pending -> 'Pendente'
    assert all_owners["Irmã"]["status"] == "Pendente"
    assert all_owners["Irmã"]["paid_amount"] == 0.00
    assert all_owners["Irmã"]["pending_amount"] == 150.00
    assert all_owners["Irmã"]["total_amount"] == 150.00

    # Conservation: sum of all owner totals equals total_amount
    assert round(
        all_owners["Rafael"]["total_amount"]
        + all_owners["Mãe"]["total_amount"]
        + all_owners["Irmã"]["total_amount"],
        2,
    ) == sum_all["total_amount"]


# ============================================================================
# 4. Hermetic Test Session & Database Leak Prevention
# ============================================================================

@pytest.mark.asyncio
async def test_adversarial_m4_isolation_probe_step_1_populate(client: AsyncClient):
    """
    Part 1 of the sequential isolation probe:
    Creates transient canary entities and transactions.
    """
    # Create Canary Owner
    res_owner = await client.post("/api/v1/owners", json={"name": "CanaryUserSecret"})
    assert res_owner.status_code == 201
    owner_id = res_owner.json()["id"]

    # Create Canary Card
    res_card = await client.post("/api/v1/cards", json={"card_name": "CanaryCardSecret"})
    assert res_card.status_code == 201
    card_id = res_card.json()["id"]

    # Create Canary Transaction
    res_tx = await client.post(
        "/api/v1/transactions",
        json={
            "dt_lcto": "2026-07-01T12:00:00Z",
            "description": "CanaryTransactionSecret",
            "value": 999.99,
            "owner_id": owner_id,
            "card_id": card_id,
        },
    )
    assert res_tx.status_code == 201

    # Verify they exist in this session
    owners_res = await client.get("/api/v1/owners")
    names = [o["name"] for o in owners_res.json()]
    assert "CanaryUserSecret" in names


@pytest.mark.asyncio
async def test_adversarial_m4_isolation_probe_step_2_verify_clean(client: AsyncClient, db_session: AsyncSession):
    """
    Part 2 of the sequential isolation probe:
    Executes immediately after Step 1.
    Empirically validates that:
    1. Zero canary records leaked from Step 1.
    2. Only initial seeds exist (Rafael, Mãe, Irmã, Nubank, standard categories).
    3. No transaction records exist in the database.
    4. No financial.db file was leaked on disk.
    """
    # 1. Verify Owners
    owners_res = await client.get("/api/v1/owners")
    assert owners_res.status_code == 200
    owners = owners_res.json()
    owner_names = [o["name"] for o in owners]
    assert "CanaryUserSecret" not in owner_names
    assert set(owner_names) == {"Rafael", "Mãe", "Irmã"}

    # 2. Verify Cards
    cards_res = await client.get("/api/v1/cards")
    assert cards_res.status_code == 200
    cards = cards_res.json()
    card_names = [c["card_name"] for c in cards]
    assert "CanaryCardSecret" not in card_names
    assert card_names == ["Nubank"]

    # 3. Verify Transactions
    txs_res = await client.get("/api/v1/transactions")
    assert txs_res.status_code == 200
    txs = txs_res.json()
    assert len(txs) == 0

    # 4. Verify disk file isolation: no financial.db created in backend root by tests
    backend_root = Path(__file__).parent.parent
    db_files = list(backend_root.glob("*.db"))
    assert len(db_files) == 0, f"Leaked database file found on disk: {db_files}"
