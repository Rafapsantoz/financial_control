import json
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai.errors import APIError

from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.services.gemini_service import (
    assign_heuristic_owner,
    decompose_installments,
    match_category,
    normalize_text,
)

# Valid minimal synthetic PDF bytes
SYNTHETIC_PDF_BYTES = (
    b"%PDF-1.4\n"
    b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
    b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
    b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
    b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
    b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
)

SAMPLE_STRUCTURED_RESPONSE = {
    "bank_or_issuer": "Nubank",
    "invoice_month_year": "2026-11",
    "due_date": "2026-11-10",
    "total_invoice_amount": 350.50,
    "items": [
        {
            "purchase_date": "2026-10-15",
            "description": "Drogaria São Paulo",
            "amount": 75.30,
            "current_installment": 1,
            "total_installments": 1,
            "suggested_category": "Farmácia",
            "suggested_owner": None,
        },
        {
            "purchase_date": "2026-10-18",
            "description": "Zara Brasil 02/05",
            "amount": 120.00,
            "current_installment": 1,
            "total_installments": 1,
            "suggested_category": "Roupas",
            "suggested_owner": None,
        },
        {
            "purchase_date": "2026-10-20",
            "description": "Steam Games Purchase",
            "amount": 55.20,
            "current_installment": 1,
            "total_installments": 1,
            "suggested_category": "Lazer",
            "suggested_owner": None,
        },
        {
            "purchase_date": "2026-10-22",
            "description": "Supermercado Extra",
            "amount": 100.00,
            "current_installment": 1,
            "total_installments": 1,
            "suggested_category": "Mercado",
            "suggested_owner": "Cartão Adicional - IRMA",
        },
    ],
}


# ============================================================================
# 1. Unit Tests for Pure Helper Functions
# ============================================================================

def test_decompose_installments_various_formats():
    """Validates installment extraction patterns from description strings."""
    # Pattern: 01/03
    assert decompose_installments("Loja Magazine 01/03", 1, 1) == (1, 3)
    # Pattern: 02/10
    assert decompose_installments("CASAS BAHIA 02/10", 1, 1) == (2, 10)
    # Pattern: Parcela 04 de 06
    assert decompose_installments("Mercado Livre Parcela 04 de 06", 1, 1) == (4, 6)
    # Pattern: PARC 03/12
    assert decompose_installments("Curso Python PARC. 03/12", 1, 1) == (3, 12)
    # Pattern: 05 de 08
    assert decompose_installments("Samsung Eletronicos 05 de 08", 1, 1) == (5, 8)
    # Single purchase (no installment tokens)
    assert decompose_installments("Padaria Pão Quente", 1, 1) == (1, 1)
    # Preserves already parsed valid values
    assert decompose_installments("Loja Qualquer", 3, 5) == (3, 5)


def test_assign_heuristic_owner():
    """Validates heuristic assignment: Drogarias -> Mãe, Zara/Shein -> Irmã, Steam/iFood -> Rafael."""
    fake_owners = {
        "RAFAEL": SimpleNamespace(id=1, name="Rafael"),
        "MAE": SimpleNamespace(id=2, name="Mãe"),
        "IRMA": SimpleNamespace(id=3, name="Irmã"),
    }

    # Drogaria / Farmácia -> Mãe
    name, oid = assign_heuristic_owner(None, "Drogaria São Paulo", fake_owners)
    assert name == "Mãe" and oid == 2

    name, oid = assign_heuristic_owner(None, "FARMÁCIA RAIA", fake_owners)
    assert name == "Mãe" and oid == 2

    # Zara / Shein -> Irmã
    name, oid = assign_heuristic_owner(None, "Zara Shopping Morumbi", fake_owners)
    assert name == "Irmã" and oid == 3

    name, oid = assign_heuristic_owner(None, "SHEIN Brasil Online", fake_owners)
    assert name == "Irmã" and oid == 3

    # Steam / iFood -> Rafael
    name, oid = assign_heuristic_owner(None, "STEAM PURCHASE GAMES", fake_owners)
    assert name == "Rafael" and oid == 1

    name, oid = assign_heuristic_owner(None, "IFOOD RESTAURANTE SP", fake_owners)
    assert name == "Rafael" and oid == 1

    # Additional card takes precedence
    name, oid = assign_heuristic_owner("Cartão Final 1234 - IRMA", "Drogaria Teste", fake_owners)
    assert name == "Irmã" and oid == 3

    # Fallback to Rafael
    name, oid = assign_heuristic_owner(None, "Loja de Ferramentas ABC", fake_owners)
    assert name == "Rafael" and oid == 1


def test_match_category():
    """Validates category normalization against standard database categories."""
    fake_categories = {
        "MERCADO": SimpleNamespace(id=1, description="Mercado"),
        "LAZER": SimpleNamespace(id=2, description="Lazer"),
        "FARMACIA": SimpleNamespace(id=3, description="Farmácia"),
        "RESTAURANTE": SimpleNamespace(id=4, description="Restaurante"),
        "ROUPAS": SimpleNamespace(id=5, description="Roupas"),
        "ASSINATURAS": SimpleNamespace(id=6, description="Assinaturas"),
        "TRANSPORTE": SimpleNamespace(id=7, description="Transporte"),
        "OUTROS": SimpleNamespace(id=8, description="Outros"),
    }

    # Direct match
    desc, cid = match_category("Mercado", "Carrefour", fake_categories)
    assert desc == "Mercado" and cid == 1

    # Synonym matching
    desc, cid = match_category("Alimentação", "Almoço Executivo", fake_categories)
    assert desc == "Restaurante" and cid == 4

    # Description scan
    desc, cid = match_category("Desconhecido", "Corrida Uber * Centro", fake_categories)
    assert desc == "Transporte" and cid == 7

    # Fallback to Outros
    desc, cid = match_category("XYZ Desconhecido", "Algo Aleatorio", fake_categories)
    assert desc == "Outros" and cid == 8


# ============================================================================
# 2. Integration Tests for POST /api/v1/invoices/extract
# ============================================================================

@pytest.mark.asyncio
async def test_extract_invoice_pdf_success_with_mock(client: AsyncClient, db_session: AsyncSession):
    """
    Tests end-to-end extraction endpoint with synthetic PDF and hermetic mock of google-genai.
    Verifies that:
    - PDF is ingested and parsed
    - Heuristics assign owners correctly
    - Installment decomposition works
    - Seeded Nubank card is auto-associated
    """
    mock_response = MagicMock()
    mock_response.text = json.dumps(SAMPLE_STRUCTURED_RESPONSE)
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client_instance

        files = {
            "file": ("fatura_nubank_nov.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")
        }
        response = await client.post("/api/v1/invoices/extract", files=files)

        assert response.status_code == 200
        data = response.json()

        assert data["bank_or_issuer"] == "Nubank"
        assert data["invoice_month_year"] == "2026-11"
        assert data["due_date"] == "2026-11-10"
        assert data["total_invoice_amount"] == 350.50
        assert data["card_id"] == 1  # Nubank card seeded in conftest
        assert len(data["items"]) == 4

        # Item 1: Drogaria -> Mãe
        item_mae = data["items"][0]
        assert item_mae["description"] == "Drogaria São Paulo"
        assert item_mae["suggested_owner"] == "Mãe"
        assert item_mae["owner_id"] is not None
        assert item_mae["suggested_category"] == "Farmácia"
        assert item_mae["is_duplicate"] is False

        # Item 2: Zara 02/05 -> Irmã with installments decomposed
        item_irma = data["items"][1]
        assert item_irma["current_installment"] == 2
        assert item_irma["total_installments"] == 5
        assert item_irma["suggested_owner"] == "Irmã"

        # Item 3: Steam -> Rafael
        item_rafael = data["items"][2]
        assert item_rafael["suggested_owner"] == "Rafael"

        # Item 4: Additional card -> Irmã
        item_add = data["items"][3]
        assert item_add["suggested_owner"] == "Irmã"


@pytest.mark.asyncio
async def test_extract_invoice_duplicate_detection_rn02(client: AsyncClient, db_session: AsyncSession):
    """
    Verifies Rule RN02 (Invoice Duplicate Detection):
    If an identical transaction (date, description, value) exists, is_duplicate is set to True.
    """
    # Pre-insert existing transaction matching Item 1
    existing_tx = Transaction(
        dt_lcto=datetime(2026, 10, 15, 12, 0, 0, tzinfo=timezone.utc),
        description="Drogaria São Paulo",
        value=75.30,
        card_id=1,
        owner_id=2,
        type_id=3,
        total_parcs=1,
        cur_parcs=1,
        is_paid=False,
    )
    db_session.add(existing_tx)
    await db_session.commit()

    mock_response = MagicMock()
    mock_response.text = json.dumps(SAMPLE_STRUCTURED_RESPONSE)
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client_instance

        files = {
            "file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")
        }
        response = await client.post("/api/v1/invoices/extract", files=files)

        assert response.status_code == 200
        data = response.json()

        # Item 1 must be marked as duplicate
        assert data["items"][0]["is_duplicate"] is True
        # Other items must be False
        assert data["items"][1]["is_duplicate"] is False
        assert data["items"][2]["is_duplicate"] is False
        assert data["items"][3]["is_duplicate"] is False


@pytest.mark.asyncio
async def test_extract_invoice_rejects_non_pdf(client: AsyncClient):
    """Rejects non-PDF files with 400 Bad Request."""
    files = {
        "file": ("documento.txt", b"Texto simples", "text/plain")
    }
    response = await client.post("/api/v1/invoices/extract", files=files)
    assert response.status_code == 400
    assert "Apenas arquivos no formato PDF" in response.json()["detail"]


@pytest.mark.asyncio
async def test_extract_invoice_rejects_empty_file(client: AsyncClient):
    """Rejects empty PDF files (0 bytes) with 400 Bad Request."""
    files = {
        "file": ("vazio.pdf", b"", "application/pdf")
    }
    response = await client.post("/api/v1/invoices/extract", files=files)
    assert response.status_code == 400
    assert "vazio" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_extract_invoice_rejects_corrupted_pdf_header(client: AsyncClient):
    """Rejects corrupted PDF files without '%PDF-' header with 400 Bad Request."""
    files = {
        "file": ("corrompido.pdf", b"NOT_A_VALID_PDF_HEADER_CONTENT", "application/pdf")
    }
    response = await client.post("/api/v1/invoices/extract", files=files)
    assert response.status_code == 400
    assert "cabeçalho PDF" in response.json()["detail"]


@pytest.mark.asyncio
async def test_extract_invoice_rejects_invalid_card_id(client: AsyncClient):
    """Rejects extract request when card_id does not exist with 400 Bad Request."""
    files = {
        "file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")
    }
    response = await client.post("/api/v1/invoices/extract?card_id=9999", files=files)
    assert response.status_code == 400
    assert "não existe" in response.json()["detail"]


@pytest.mark.asyncio
async def test_extract_invoice_handles_gemini_quota_error_503(client: AsyncClient):
    """Translates Gemini rate limit / quota exhaustion (429) to HTTP 503."""
    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(
            side_effect=APIError(429, {"error": {"message": "Resource Exhausted: Quota limit reached", "status": "RESOURCE_EXHAUSTED"}})
        )
        mock_get_client.return_value = mock_client_instance

        files = {
            "file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")
        }
        response = await client.post("/api/v1/invoices/extract", files=files)
        assert response.status_code == 503
        assert "Cota" in response.json()["detail"] or "rate limit" in response.json()["detail"]


@pytest.mark.asyncio
async def test_extract_invoice_handles_gemini_malformed_response_502(client: AsyncClient):
    """Translates Gemini invalid/malformed JSON output to HTTP 502 Bad Gateway."""
    mock_response = MagicMock()
    mock_response.text = "This is not valid JSON string {"
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client_instance

        files = {
            "file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")
        }
        response = await client.post("/api/v1/invoices/extract", files=files)
        assert response.status_code == 502
        assert "Falha ao interpretar resposta estruturada" in response.json()["detail"]


# ============================================================================
# 3. Integration Tests for POST /api/v1/invoices/confirm
# ============================================================================

@pytest.mark.asyncio
async def test_confirm_invoice_batch_success(client: AsyncClient, db_session: AsyncSession):
    """
    Tests batch confirmation of extracted items:
    Persists transactions in SQLite and verifies returned response and database state.
    """
    payload = {
        "card_id": 1,
        "project_future_installments": False,
        "items": [
            {
                "purchase_date": "2026-10-15",
                "description": "Drogaria São Paulo",
                "value": 75.30,
                "owner_id": 2,  # Mãe
                "type_id": 3,   # Farmácia
                "total_parcs": 1,
                "cur_parcs": 1,
                "is_paid": False,
            },
            {
                "purchase_date": "2026-10-18",
                "description": "Zara Brasil",
                "value": 120.00,
                "owner_id": 3,  # Irmã
                "type_id": 5,   # Roupas
                "total_parcs": 5,
                "cur_parcs": 2,
                "is_paid": False,
            },
            {
                "purchase_date": "2026-10-20",
                "description": "Steam Games",
                "amount": 55.20,  # Tests alias 'amount' -> 'value'
                "owner_id": 1,  # Rafael
                "category_id": 2,  # Tests alias 'category_id' -> 'type_id' (Lazer)
                "total_parcs": 1,
                "cur_parcs": 1,
                "is_paid": True,
            },
        ],
    }

    response = await client.post("/api/v1/invoices/confirm", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["confirmed_count"] == 3
    assert data["total_amount"] == 250.50
    assert len(data["created_transactions"]) == 3

    # Query database directly to confirm persistence
    result = await db_session.execute(select(Transaction))
    db_transactions = result.scalars().all()
    assert len(db_transactions) == 3

    descs = [tx.description for tx in db_transactions]
    assert "Drogaria São Paulo" in descs
    assert "Zara Brasil" in descs
    assert "Steam Games" in descs


@pytest.mark.asyncio
async def test_confirm_invoice_with_target_month_alignment(client: AsyncClient, db_session: AsyncSession):
    """
    Tests that when target_month is provided:
    1. The actual purchase date (dt_lcto) from October is preserved (e.g. 2026-10-15).
    2. The billing cycle (invoice_month) is set to the target invoice month (2026-11).
    3. The transaction is correctly included in the November dashboard and transaction list.
    """
    payload = {
        "card_id": 1,
        "target_month": "2026-11",
        "items": [
            {
                "purchase_date": "2026-10-15",
                "description": "Shein Roupa Nova",
                "value": 99.90,
                "owner_id": 3,
                "type_id": 5,
                "total_parcs": 1,
                "cur_parcs": 1,
            }
        ],
    }

    response = await client.post("/api/v1/invoices/confirm", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["confirmed_count"] == 1

    created_tx = data["created_transactions"][0]
    # Real purchase date is preserved
    assert created_tx["dt_lcto"].startswith("2026-10-15")
    # Invoice month is November 2026
    assert created_tx["invoice_month"] == "2026-11"

    # Verify it is queried in November dashboard summary
    dash_res = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    irma_summary = next(o for o in dash_data["owners_summary"] if o["owner_id"] == 3)
    assert irma_summary["total_amount"] >= 99.90

    # Verify it is queried in GET /api/v1/transactions?month=2026-11
    tx_res = await client.get("/api/v1/transactions?month=2026-11")
    assert tx_res.status_code == 200
    tx_list = tx_res.json()
    assert any(t["description"] == "Shein Roupa Nova" for t in tx_list)

    # Verify it is queried in November dashboard summary
    dash_res = await client.get("/api/v1/dashboard/summary?month=2026-11")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    irma_summary = next(o for o in dash_data["owners_summary"] if o["owner_id"] == 3)
    assert irma_summary["total_amount"] >= 99.90


@pytest.mark.asyncio
async def test_confirm_invoice_with_future_installments_projection(client: AsyncClient, db_session: AsyncSession):
    """
    Tests installment projection (RN01) during confirmation:
    When project_future_installments=True and total_parcs > cur_parcs,
    future installments are projected with is_forecast=True.
    """
    payload = {
        "card_id": 1,
        "project_future_installments": True,
        "items": [
            {
                "purchase_date": "2026-10-01",
                "description": "Notebook Dell",
                "value": 1000.00,
                "owner_id": 1,
                "type_id": 8,
                "total_parcs": 3,
                "cur_parcs": 1,
            }
        ],
    }

    response = await client.post("/api/v1/invoices/confirm", json=payload)
    assert response.status_code == 201

    data = response.json()
    # 1 current installment + 2 projected installments = 3 transactions
    assert data["confirmed_count"] == 3
    assert data["total_amount"] == 3000.00

    result = await db_session.execute(select(Transaction).order_by(Transaction.cur_parcs))
    txs = result.scalars().all()
    assert len(txs) == 3

    # Parcela 1 (atual)
    assert txs[0].cur_parcs == 1
    assert txs[0].is_forecast is False

    # Parcela 2 (projetada para mês seguinte)
    assert txs[1].cur_parcs == 2
    assert txs[1].is_forecast is True
    assert txs[1].dt_lcto.month == 11

    # Parcela 3 (projetada para 2 meses depois)
    assert txs[2].cur_parcs == 3
    assert txs[2].is_forecast is True
    assert txs[2].dt_lcto.month == 12


@pytest.mark.asyncio
async def test_confirm_invoice_validation_failures(client: AsyncClient):
    """Tests validation edge cases during confirmation."""
    # 1. Empty items list
    resp_empty = await client.post("/api/v1/invoices/confirm", json={"items": []})
    assert resp_empty.status_code in (400, 422)

    # 2. Non-existent owner_id
    payload_bad_owner = {
        "items": [
            {
                "description": "Compra Teste",
                "value": 50.0,
                "owner_id": 9999,
            }
        ]
    }
    resp_bad_owner = await client.post("/api/v1/invoices/confirm", json=payload_bad_owner)
    assert resp_bad_owner.status_code == 400
    assert "Proprietário com ID 9999 não existe" in resp_bad_owner.json()["detail"]

    # 3. Non-existent card_id
    payload_bad_card = {
        "card_id": 9999,
        "items": [
            {
                "description": "Compra Teste",
                "value": 50.0,
                "owner_id": 1,
            }
        ]
    }
    resp_bad_card = await client.post("/api/v1/invoices/confirm", json=payload_bad_card)
    assert resp_bad_card.status_code == 400
    assert "Cartão" in resp_bad_card.json()["detail"]

    # 4. Non-existent category (type_id)
    payload_bad_type = {
        "items": [
            {
                "description": "Compra Teste",
                "value": 50.0,
                "type_id": 9999,
            }
        ]
    }
    resp_bad_type = await client.post("/api/v1/invoices/confirm", json=payload_bad_type)
    assert resp_bad_type.status_code == 400
    assert "Categoria com ID 9999 não existe" in resp_bad_type.json()["detail"]


@pytest.mark.asyncio
async def test_extract_invoice_form_card_id_and_unmatched_issuer(client: AsyncClient):
    """
    Tests extract endpoint when card_id is provided via multipart Form data
    and issuer does not match any card in database.
    """
    custom_response = {
        "bank_or_issuer": "Banco Desconhecido XYZ",
        "invoice_month_year": "2026-12",
        "due_date": "2026-12-05",
        "total_invoice_amount": 0.0,  # Zero total to trigger auto-sum
        "items": [
            {
                "purchase_date": "2026-11-20",
                "description": "FARMÁCIA CENTRAL DROGARIA",
                "amount": 80.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Saúde",
            },
            {
                "purchase_date": "2026-11-22",
                "description": "SHEIN Moda Feminina",
                "amount": 120.00,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Vestuário",
            },
        ],
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(custom_response)
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_instance = MagicMock()
        mock_client_instance.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client_instance

        # 1. Test with card_id via form data
        files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        data = {"card_id": 1}
        response = await client.post("/api/v1/invoices/extract", files=files, data=data)
        assert response.status_code == 200
        res_json = response.json()
        assert res_json["card_id"] == 1
        assert res_json["total_invoice_amount"] == 200.00
        assert res_json["items"][0]["suggested_owner"] == "Mãe"
        assert res_json["items"][0]["suggested_category"] == "Farmácia"
        assert res_json["items"][1]["suggested_owner"] == "Irmã"
        assert res_json["items"][1]["suggested_category"] == "Roupas"

        # 2. Test without card_id and with unknown issuer -> card_id is null
        files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        response_no_card = await client.post("/api/v1/invoices/extract", files=files)
        assert response_no_card.status_code == 200
        assert response_no_card.json()["card_id"] is None


@pytest.mark.asyncio
async def test_confirm_invoice_pydantic_schema_validations(client: AsyncClient):
    """Verifies that invalid installment ranges or negative values fail Pydantic validation."""
    # cur_parcs > total_parcs
    bad_installments_payload = {
        "items": [
            {
                "description": "Compra Invalida",
                "value": 100.0,
                "cur_parcs": 5,
                "total_parcs": 3,
            }
        ]
    }
    resp = await client.post("/api/v1/invoices/confirm", json=bad_installments_payload)
    assert resp.status_code == 422

    # negative value
    bad_val_payload = {
        "items": [
            {
                "description": "Compra Negativa",
                "value": -50.0,
            }
        ]
    }
    resp = await client.post("/api/v1/invoices/confirm", json=bad_val_payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_duplicate_invoice_upload_detection_and_history(client: AsyncClient):
    """Verifies that uploaded invoices are tracked with SHA-256 and duplicate uploads are detected."""
    # 1. Mock Gemini extraction
    mock_resp = MagicMock()
    mock_resp.text = json.dumps(SAMPLE_STRUCTURED_RESPONSE)
    mock_resp.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client_inst = MagicMock()
        mock_client_inst.aio.models.generate_content = AsyncMock(return_value=mock_resp)
        mock_get_client.return_value = mock_client_inst

        # First upload
        files = {"file": ("fatura_teste.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        r1 = await client.post("/api/v1/invoices/extract", files=files)
        assert r1.status_code == 200
        data1 = r1.json()
        assert data1["is_already_imported"] is False
        assert data1["file_hash"] is not None
        pdf_hash = data1["file_hash"]

        # Confirm batch with file_hash
        confirm_payload = {
            "card_id": 1,
            "target_month": "2026-11",
            "file_hash": pdf_hash,
            "filename": "fatura_teste.pdf",
            "bank_or_issuer": "Nubank",
            "items": [
                {
                    "description": "Compra Teste Anti-Duplicidade",
                    "value": 150.0,
                    "owner_id": 1,
                    "type_id": 1,
                    "cur_parcs": 1,
                    "total_parcs": 1,
                }
            ],
        }
        r_confirm = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
        assert r_confirm.status_code == 201

        # Second upload with the exact same file -> should detect duplicate
        files2 = {"file": ("fatura_teste.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        r2 = await client.post("/api/v1/invoices/extract", files=files2)
        assert r2.status_code == 200
        data2 = r2.json()
        assert data2["is_already_imported"] is True
        assert "já foi importado anteriormente" in data2["already_imported_message"]

        # Check list of uploads
        r_uploads = await client.get("/api/v1/invoices/uploads")
        assert r_uploads.status_code == 200
        uploads_list = r_uploads.json()
        assert len(uploads_list) >= 1
        assert any(u["file_hash"] == pdf_hash for u in uploads_list)

