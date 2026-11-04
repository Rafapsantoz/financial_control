"""
test_e2e_workflow.py — End-to-End User Workflow & Financial Lifecycle Test Suite.

Validates the full user journey and business requirements across Milestones 1 to 4:
1. Base seeds check: Rafael, Mãe, Irmã, default categories, and Nubank credit card.
2. Synthetic PDF invoice upload & multimodal Gemini extraction with hermetic mock.
3. Batch invoice confirmation and future installment projection (RN01: is_forecast=True).
4. Initial family debt rateio closure: strict value conservation, initial 'Pendente' statuses.
5. Transaction payment toggling: PATCH /api/v1/transactions/{id}/toggle-paid (RN03).
6. Post-toggle dynamic dashboard closure: dynamic transitions ('Pago', 'Parcial', 'Pendente').
7. Multi-month forecast projection inspection and activation lifecycle.
8. Re-upload duplicate detection pipeline (RN02).
9. Robustness and negative error scenarios (400, 404, 422, 409).
"""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction

# Valid minimal synthetic PDF bytes
SYNTHETIC_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
    b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
)


# ============================================================================
# 1. Base Seed Data Verification
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_base_seed_verification(client: AsyncClient):
    """
    Validates that the native SQLite database is properly seeded on startup:
    - Owners: Rafael, Mãe, Irmã
    - Categories: Mercado, Lazer, Farmácia, Restaurante, Roupas, Assinaturas, Transporte, Outros
    - Cards: Nubank
    """
    # 1. Verify Owners
    res_owners = await client.get("/api/v1/owners")
    assert res_owners.status_code == 200
    owners = res_owners.json()
    owner_names = [o["name"] for o in owners]
    assert "Rafael" in owner_names
    assert "Mãe" in owner_names
    assert "Irmã" in owner_names
    assert len(owners) >= 3

    # 2. Verify Categories
    res_cats = await client.get("/api/v1/categories")
    assert res_cats.status_code == 200
    categories = res_cats.json()
    cat_names = [c["description"] for c in categories]
    expected_categories = [
        "Mercado",
        "Lazer",
        "Farmácia",
        "Restaurante",
        "Roupas",
        "Assinaturas",
        "Transporte",
        "Outros",
    ]
    for expected_cat in expected_categories:
        assert expected_cat in cat_names

    # 3. Verify Cards
    res_cards = await client.get("/api/v1/cards")
    assert res_cards.status_code == 200
    cards = res_cards.json()
    card_names = [c["card_name"] for c in cards]
    assert "Nubank" in card_names


# ============================================================================
# 2. Full End-to-End User Journey Workflow
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_complete_monthly_financial_lifecycle(
    client: AsyncClient,
    db_session: AsyncSession,
):
    """
    Validates the end-to-end user financial lifecycle from invoice ingest to settlement:
    1. Base seed check.
    2. Upload synthetic PDF -> Gemini extracts purchases across Rafael, Mãe, Irmã (with installment 01/03).
    3. Confirm invoice -> transactions persisted + future installments projected (RN01: is_forecast=True).
    4. Initial dashboard closure -> all members 'Pendente', subtotais strictly conserved without drift.
    5. Toggle payment -> PATCH /api/v1/transactions/{id}/toggle-paid for specific transactions (RN03).
    6. Post-toggle closure -> Mãe becomes 'Pago', Rafael becomes 'Parcial', Irmã stays 'Pendente',
       and total_paid + total_pending strictly balance invoice total.
    """
    # Step A: Fetch seed reference IDs
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}
    rafael_id = owners_map["Rafael"]
    mae_id = owners_map["Mãe"]
    irma_id = owners_map["Irmã"]

    cats_res = await client.get("/api/v1/categories")
    cats_map = {c["description"]: c["id"] for c in cats_res.json()}

    cards_res = await client.get("/api/v1/cards")
    nubank_card = next(c for c in cards_res.json() if c["card_name"] == "Nubank")
    card_id = nubank_card["id"]

    # Step B: Synthetic PDF upload & Gemini extraction
    # The invoice represents November 2026 Nubank invoice with items for Rafael, Mãe, Irmã
    mock_gemini_payload = {
        "bank_or_issuer": "Nubank",
        "invoice_month_year": "2026-11",
        "due_date": "2026-11-10",
        "total_invoice_amount": 550.00,
        "items": [
            {
                "purchase_date": "2026-10-10",
                "description": "Drogaria São Paulo",
                "amount": 90.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Farmácia",
                "suggested_owner": None,  # System heuristic will resolve to Mãe
            },
            {
                "purchase_date": "2026-10-14",
                "description": "Zara Shopping 01/03",
                "amount": 150.00,
                "current_installment": 1,
                "total_installments": 1,  # In invoice text '01/03', system decomposes to (1, 3)
                "suggested_category": "Roupas",
                "suggested_owner": None,  # Heuristic will resolve to Irmã
            },
            {
                "purchase_date": "2026-10-20",
                "description": "Steam Games Digital",
                "amount": 60.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Lazer",
                "suggested_owner": None,  # Heuristic will resolve to Rafael
            },
            {
                "purchase_date": "2026-10-25",
                "description": "Supermercado Pão de Açúcar",
                "amount": 250.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Mercado",
                "suggested_owner": "Rafael",
            },
        ],
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(mock_gemini_payload)
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client_instance

        extract_res = await client.post(
            "/api/v1/invoices/extract",
            files={"file": ("fatura_nubank_nov_2026.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")},
        )
        assert extract_res.status_code == 200
        extracted_data = extract_res.json()

    assert extracted_data["bank_or_issuer"] == "Nubank"
    assert extracted_data["invoice_month_year"] == "2026-11"
    assert extracted_data["card_id"] == card_id
    assert len(extracted_data["items"]) == 4

    # Verify heuristic assignments & installment decomposition
    item_farmacia = next(i for i in extracted_data["items"] if "Drogaria" in i["description"])
    assert item_farmacia["suggested_owner"] == "Mãe"
    assert item_farmacia["owner_id"] == mae_id

    item_zara = next(i for i in extracted_data["items"] if "Zara" in i["description"])
    assert item_zara["suggested_owner"] == "Irmã"
    assert item_zara["owner_id"] == irma_id
    assert item_zara["current_installment"] == 1
    assert item_zara["total_installments"] == 3  # Decomposed from '01/03'

    item_steam = next(i for i in extracted_data["items"] if "Steam" in i["description"])
    assert item_steam["suggested_owner"] == "Rafael"
    assert item_steam["owner_id"] == rafael_id

    # Step C: Batch confirmation with future installment projection (RN01)
    confirm_payload = {
        "card_id": card_id,
        "project_future_installments": True,
        "items": [
            {
                "purchase_date": item_farmacia["purchase_date"],
                "description": item_farmacia["description"],
                "amount": item_farmacia["amount"],
                "owner_id": item_farmacia["owner_id"],
                "category_id": item_farmacia["category_id"],
                "total_parcs": item_farmacia["total_installments"],
                "cur_parcs": item_farmacia["current_installment"],
            },
            {
                "purchase_date": item_zara["purchase_date"],
                "description": item_zara["description"],
                "amount": item_zara["amount"],
                "owner_id": item_zara["owner_id"],
                "category_id": item_zara["category_id"],
                "total_parcs": item_zara["total_installments"],
                "cur_parcs": item_zara["current_installment"],
            },
            {
                "purchase_date": item_steam["purchase_date"],
                "description": item_steam["description"],
                "amount": item_steam["amount"],
                "owner_id": item_steam["owner_id"],
                "category_id": item_steam["category_id"],
                "total_parcs": item_steam["total_installments"],
                "cur_parcs": item_steam["current_installment"],
            },
            {
                "purchase_date": "2026-10-25",
                "description": "Supermercado Pão de Açúcar",
                "amount": 250.00,
                "owner_id": rafael_id,
                "category_id": cats_map["Mercado"],
                "total_parcs": 1,
                "cur_parcs": 1,
            },
        ],
    }

    confirm_res = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
    assert confirm_res.status_code == 201
    confirm_data = confirm_res.json()

    # 4 items confirmed: 1 item has 3 installments (cur=1 + 2 projected), others have 1 -> total = 6 txs
    assert confirm_data["confirmed_count"] == 6

    # Verify persistence directly in SQLite via ORM
    tx_query = await db_session.execute(select(Transaction).order_by(Transaction.id.asc()))
    saved_txs = tx_query.scalars().all()
    assert len(saved_txs) == 6

    current_month_txs = [t for t in saved_txs if not t.is_forecast]
    forecast_txs = [t for t in saved_txs if t.is_forecast]
    assert len(current_month_txs) == 4
    assert len(forecast_txs) == 2

    # Check future installments for Zara (parcelas 2/3 e 3/3)
    assert forecast_txs[0].cur_parcs == 2
    assert forecast_txs[0].total_parcs == 3
    assert forecast_txs[0].dt_lcto.month == 11  # Next month relative to 2026-10
    assert forecast_txs[0].is_forecast is True

    assert forecast_txs[1].cur_parcs == 3
    assert forecast_txs[1].total_parcs == 3
    assert forecast_txs[1].dt_lcto.month == 12  # Two months later
    assert forecast_txs[1].is_forecast is True

    # Step D: Initial Family Closure Check (GET /api/v1/dashboard/summary)
    summary_res = await client.get("/api/v1/dashboard/summary?month=2026-10")
    assert summary_res.status_code == 200
    summary_data = summary_res.json()

    # Total in October: 90.00 + 150.00 + 60.00 + 250.00 = 550.00
    assert summary_data["total_amount"] == 550.00
    assert summary_data["total_paid"] == 0.00
    assert summary_data["total_pending"] == 550.00
    assert summary_data["total_amount"] == round(
        summary_data["total_paid"] + summary_data["total_pending"], 2
    )

    owners_summary = {o["owner_name"]: o for o in summary_data["owners_summary"]}

    # Mãe: 90.00, unpaid -> 'Pendente'
    assert owners_summary["Mãe"]["total_amount"] == 90.00
    assert owners_summary["Mãe"]["paid_amount"] == 0.00
    assert owners_summary["Mãe"]["pending_amount"] == 90.00
    assert owners_summary["Mãe"]["status"] == "Pendente"
    assert owners_summary["Mãe"]["transactions_count"] == 1

    # Irmã: 150.00 (only parcela 1/3 in October; parcs 2 and 3 are forecast in Nov/Dec) -> 'Pendente'
    assert owners_summary["Irmã"]["total_amount"] == 150.00
    assert owners_summary["Irmã"]["paid_amount"] == 0.00
    assert owners_summary["Irmã"]["pending_amount"] == 150.00
    assert owners_summary["Irmã"]["status"] == "Pendente"
    assert owners_summary["Irmã"]["transactions_count"] == 1

    # Rafael: 60.00 + 250.00 = 310.00 -> 'Pendente'
    assert owners_summary["Rafael"]["total_amount"] == 310.00
    assert owners_summary["Rafael"]["paid_amount"] == 0.00
    assert owners_summary["Rafael"]["pending_amount"] == 310.00
    assert owners_summary["Rafael"]["status"] == "Pendente"
    assert owners_summary["Rafael"]["transactions_count"] == 2

    # Verify zero-drift rateio conservation
    sum_owners = round(
        owners_summary["Mãe"]["total_amount"]
        + owners_summary["Irmã"]["total_amount"]
        + owners_summary["Rafael"]["total_amount"],
        2,
    )
    assert sum_owners == summary_data["total_amount"]

    # Step E: Toggle Payment (PATCH /api/v1/transactions/{id}/toggle-paid)
    # Find Mãe's transaction ID
    mae_tx = next(t for t in current_month_txs if t.owner_id == mae_id)
    # Find Rafael's Steam transaction ID
    rafael_steam_tx = next(
        t for t in current_month_txs if t.owner_id == rafael_id and "Steam" in t.description
    )

    # 1. Mãe pays her share in full
    toggle_mae_res = await client.patch(f"/api/v1/transactions/{mae_tx.id}/toggle-paid")
    assert toggle_mae_res.status_code == 200
    assert toggle_mae_res.json()["is_paid"] is True

    # 2. Rafael pays one of his two transactions (Steam: 60.00 paid, Mercado: 250.00 unpaid)
    toggle_rafael_res = await client.patch(f"/api/v1/transactions/{rafael_steam_tx.id}/toggle-paid")
    assert toggle_rafael_res.status_code == 200
    assert toggle_rafael_res.json()["is_paid"] is True

    # Step F: Post-Toggle Dynamic Closure Verification
    updated_summary_res = await client.get("/api/v1/dashboard/summary?month=2026-10")
    assert updated_summary_res.status_code == 200
    updated_summary = updated_summary_res.json()

    # Total amounts must balance strictly:
    # Paid: Mãe (90.00) + Rafael Steam (60.00) = 150.00
    # Pending: Rafael Mercado (250.00) + Irmã Zara (150.00) = 400.00
    assert updated_summary["total_paid"] == 150.00
    assert updated_summary["total_pending"] == 400.00
    assert updated_summary["total_amount"] == 550.00
    assert updated_summary["total_amount"] == round(
        updated_summary["total_paid"] + updated_summary["total_pending"], 2
    )

    updated_owners = {o["owner_name"]: o for o in updated_summary["owners_summary"]}

    # Mãe: fully paid -> 'Pago'
    assert updated_owners["Mãe"]["paid_amount"] == 90.00
    assert updated_owners["Mãe"]["pending_amount"] == 0.00
    assert updated_owners["Mãe"]["status"] == "Pago"

    # Rafael: partially paid -> 'Parcial'
    assert updated_owners["Rafael"]["paid_amount"] == 60.00
    assert updated_owners["Rafael"]["pending_amount"] == 250.00
    assert updated_owners["Rafael"]["status"] == "Parcial"

    # Irmã: unpaid -> stays 'Pendente'
    assert updated_owners["Irmã"]["paid_amount"] == 0.00
    assert updated_owners["Irmã"]["pending_amount"] == 150.00
    assert updated_owners["Irmã"]["status"] == "Pendente"

    # Step G: Reversible toggle check
    # Toggle Mãe back to unpaid -> verifies full toggle cycle
    re_toggle_mae = await client.patch(f"/api/v1/transactions/{mae_tx.id}/toggle-paid")
    assert re_toggle_mae.status_code == 200
    assert re_toggle_mae.json()["is_paid"] is False

    re_summary_res = await client.get("/api/v1/dashboard/summary?month=2026-10")
    re_owners = {o["owner_name"]: o for o in re_summary_res.json()["owners_summary"]}
    assert re_owners["Mãe"]["status"] == "Pendente"
    assert re_owners["Mãe"]["paid_amount"] == 0.00
    assert re_owners["Mãe"]["pending_amount"] == 90.00


# ============================================================================
# 3. Installment Projection Across Multiple Months (RN01)
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_installment_projection_lifecycle(client: AsyncClient, db_session: AsyncSession):
    """
    Validates end-to-end multi-month installment projection:
    - Purchase in 3 installments (cur_parcs=1, total_parcs=3) made in October.
    - November installment is initially marked is_forecast=True and excluded from November summary.
    - Once confirmed or activated (is_forecast=False), it seamlessly enters the November closure.
    """
    owners_res = await client.get("/api/v1/owners")
    rafael_id = next(o["id"] for o in owners_res.json() if o["name"] == "Rafael")

    payload = {
        "project_future_installments": True,
        "items": [
            {
                "purchase_date": "2026-10-05",
                "description": "Smart TV Samsung 01/03",
                "value": 600.00,
                "owner_id": rafael_id,
                "total_parcs": 3,
                "cur_parcs": 1,
            }
        ],
    }

    confirm_res = await client.post("/api/v1/invoices/confirm", json=payload)
    assert confirm_res.status_code == 201
    assert confirm_res.json()["confirmed_count"] == 3

    # Query forecasted transactions for November (2026-11)
    tx_res = await client.get("/api/v1/transactions?month=2026-11&is_forecast=true")
    assert tx_res.status_code == 200
    forecast_txs = tx_res.json()
    assert len(forecast_txs) == 1
    assert forecast_txs[0]["cur_parcs"] == 2
    assert forecast_txs[0]["total_parcs"] == 3
    assert forecast_txs[0]["is_forecast"] is True
    nov_tx_id = forecast_txs[0]["id"]

    # In November summary, forecast transactions are excluded by default
    nov_summary_empty = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert nov_summary_empty.status_code == 200
    assert nov_summary_empty.json()["total_amount"] == 0.00

    # Activate November transaction (is_forecast=False)
    update_res = await client.put(f"/api/v1/transactions/{nov_tx_id}", json={"is_forecast": False})
    assert update_res.status_code == 200
    assert update_res.json()["is_forecast"] is False

    # Now November summary reflects the activated installment
    nov_summary_active = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert nov_summary_active.status_code == 200
    assert nov_summary_active.json()["total_amount"] == 600.00
    rafael_nov = next(o for o in nov_summary_active.json()["owners_summary"] if o["owner_name"] == "Rafael")
    assert rafael_nov["total_amount"] == 600.00
    assert rafael_nov["status"] == "Pendente"


# ============================================================================
# 4. Duplicate Invoice Re-Upload Detection (RN02)
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_duplicate_invoice_reupload_rn02(client: AsyncClient):
    """
    Validates end-to-end duplicate detection (RN02):
    1. Upload and confirm invoice item.
    2. Upload the same invoice again.
    3. The pipeline identifies the item as is_duplicate=True.
    """
    owners_res = await client.get("/api/v1/owners")
    rafael_id = next(o["id"] for o in owners_res.json() if o["name"] == "Rafael")

    # Seed transaction in DB
    tx_payload = {
        "dt_lcto": "2026-11-01T12:00:00Z",
        "description": "Posto Shell Combustivel",
        "value": 180.00,
        "owner_id": rafael_id,
        "card_id": 1,
    }
    create_tx_res = await client.post("/api/v1/transactions", json=tx_payload)
    assert create_tx_res.status_code == 201

    # Simulate re-uploading an invoice with the identical transaction
    duplicate_mock = {
        "bank_or_issuer": "Nubank",
        "invoice_month_year": "2026-11",
        "due_date": "2026-11-10",
        "total_invoice_amount": 180.00,
        "items": [
            {
                "purchase_date": "2026-11-01",
                "description": "Posto Shell Combustivel",
                "amount": 180.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Transporte",
                "suggested_owner": "Rafael",
            }
        ],
    }

    mock_resp = MagicMock()
    mock_resp.text = json.dumps(duplicate_mock)
    mock_resp.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_resp)
        mock_get_client.return_value = mock_client_instance

        extract_res = await client.post(
            "/api/v1/invoices/extract",
            files={"file": ("fatura_segunda_via.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")},
        )
        assert extract_res.status_code == 200
        extracted = extract_res.json()

        assert len(extracted["items"]) == 1
        assert extracted["items"][0]["description"] == "Posto Shell Combustivel"
        assert extracted["items"][0]["is_duplicate"] is True


# ============================================================================
# 5. Robustness and Negative Tests Suite
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_robustness_negative_scenarios(client: AsyncClient):
    """
    Validates boundary conditions and HTTP error codes:
    1. Non-PDF upload returns 400 Bad Request.
    2. Malformed month format returns 422 Unprocessable Entity.
    3. Non-existent card ID returns 404 on dashboard / get card.
    4. Non-existent transaction ID returns 404 on toggle-paid.
    5. Confirmation with empty items returns 400 or 422.
    """
    # 1. Non-PDF upload rejection (400)
    non_pdf_file = {"file": ("extrato.txt", b"arquivo de texto comum", "text/plain")}
    res_non_pdf = await client.post("/api/v1/invoices/extract", files=non_pdf_file)
    assert res_non_pdf.status_code == 400
    assert "Apenas arquivos no formato PDF são aceitos" in res_non_pdf.json()["detail"]

    # 2. Malformed month format on dashboard summary (422)
    bad_months = ["2026-13", "2026/11", "invalid-month", "2026-0", "2026-1"]
    for bad_month in bad_months:
        res_bad_month = await client.get(f"/api/v1/dashboard/summary?month={bad_month}")
        assert res_bad_month.status_code == 422

    # Malformed month format on transactions list (422)
    res_bad_tx_month = await client.get("/api/v1/transactions?month=abc-def")
    assert res_bad_tx_month.status_code == 422

    # 3. Non-existent card ID
    # On GET /api/v1/cards/{id} -> 404
    res_bad_card_get = await client.get("/api/v1/cards/99999")
    assert res_bad_card_get.status_code == 404

    # On GET /api/v1/dashboard/summary?month=2026-11&card_id=99999 -> 404
    res_bad_card_summary = await client.get("/api/v1/dashboard/summary?month=2026-11&card_id=99999")
    assert res_bad_card_summary.status_code == 404
    assert "Cartão com ID 99999 não encontrado" in res_bad_card_summary.json()["detail"]

    # On POST /api/v1/invoices/extract with invalid card_id -> 400
    res_bad_card_extract = await client.post(
        "/api/v1/invoices/extract?card_id=99999",
        files={"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")},
    )
    assert res_bad_card_extract.status_code == 400
    assert "Cartão com ID 99999 não existe" in res_bad_card_extract.json()["detail"]

    # 4. Toggle non-existent transaction (404)
    res_bad_toggle = await client.patch("/api/v1/transactions/999999/toggle-paid")
    assert res_bad_toggle.status_code == 404
    assert "Transação com ID 999999 não encontrada" in res_bad_toggle.json()["detail"]

    # 5. Confirm invoice with empty items list (400 / 422)
    res_empty_confirm = await client.post("/api/v1/invoices/confirm", json={"items": []})
    assert res_empty_confirm.status_code in (400, 422)


# ============================================================================
# 6. Multi-Owner Debt Settlement Edge Cases
# ============================================================================

@pytest.mark.asyncio
async def test_e2e_all_members_paid_and_floating_point_cents(client: AsyncClient):
    """
    Validates edge case where all members fully pay and cent split is preserved:
    - Rafael, Mãe, Irmã each have an expense with fractional cents.
    - Toggling all to paid transitions all members to 'Pago'.
    - total_pending drops strictly to 0.00 and total_paid equals total_amount.
    """
    owners_res = await client.get("/api/v1/owners")
    owners_map = {o["name"]: o["id"] for o in owners_res.json()}

    # Insert 3 fractional transactions (33.33, 33.33, 33.34 = 100.00)
    tx1_res = await client.post(
        "/api/v1/transactions",
        json={
            "dt_lcto": "2026-09-01T12:00:00Z",
            "description": "Item Rafael Cent",
            "value": 33.33,
            "owner_id": owners_map["Rafael"],
            "is_paid": False,
        },
    )
    tx2_res = await client.post(
        "/api/v1/transactions",
        json={
            "dt_lcto": "2026-09-02T12:00:00Z",
            "description": "Item Mãe Cent",
            "value": 33.33,
            "owner_id": owners_map["Mãe"],
            "is_paid": False,
        },
    )
    tx3_res = await client.post(
        "/api/v1/transactions",
        json={
            "dt_lcto": "2026-09-03T12:00:00Z",
            "description": "Item Irmã Cent",
            "value": 33.34,
            "owner_id": owners_map["Irmã"],
            "is_paid": False,
        },
    )

    t1_id = tx1_res.json()["id"]
    t2_id = tx2_res.json()["id"]
    t3_id = tx3_res.json()["id"]

    # Toggle all to paid
    await client.patch(f"/api/v1/transactions/{t1_id}/toggle-paid")
    await client.patch(f"/api/v1/transactions/{t2_id}/toggle-paid")
    await client.patch(f"/api/v1/transactions/{t3_id}/toggle-paid")

    summary_res = await client.get("/api/v1/dashboard/summary?month=2026-09")
    data = summary_res.json()

    assert data["total_amount"] == 100.00
    assert data["total_paid"] == 100.00
    assert data["total_pending"] == 0.00
    assert data["total_amount"] == round(data["total_paid"] + data["total_pending"], 2)

    for owner_summary in data["owners_summary"]:
        assert owner_summary["status"] == "Pago"
        assert owner_summary["pending_amount"] == 0.00
        assert owner_summary["paid_amount"] == owner_summary["total_amount"]
