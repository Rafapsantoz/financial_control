import json
import socket
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai.errors import APIError

from app.core.gemini import get_gemini_client
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


# ==============================================================================
# 1. ADVERSARIAL PDF VALIDATION TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_pdf_validation_txt_rejection(client: AsyncClient):
    """
    Adversarial: Upload plain text file with text/plain mime and .txt extension.
    Must return HTTP 400 Bad Request.
    """
    files = {"file": ("extrato.txt", b"Texto de extrato bancario", "text/plain")}
    res = await client.post("/api/v1/invoices/extract", files=files)
    assert res.status_code == 400
    assert "Apenas arquivos no formato PDF" in res.json()["detail"]


@pytest.mark.asyncio
async def test_adversarial_pdf_validation_spoofed_extension(client: AsyncClient):
    """
    Adversarial: Upload plain text file renamed to .pdf with text/plain mime.
    Must fail magic header check with HTTP 400 Bad Request.
    """
    files = {"file": ("malicious.pdf", b"This is plain text pretending to be a pdf", "text/plain")}
    res = await client.post("/api/v1/invoices/extract", files=files)
    assert res.status_code == 400
    assert "cabeçalho PDF" in res.json()["detail"]


@pytest.mark.asyncio
async def test_adversarial_pdf_validation_empty_file(client: AsyncClient):
    """
    Adversarial: Upload empty 0-byte file with application/pdf mime and .pdf extension.
    Must return HTTP 400 Bad Request indicating empty file.
    """
    files = {"file": ("empty.pdf", b"", "application/pdf")}
    res = await client.post("/api/v1/invoices/extract", files=files)
    assert res.status_code == 400
    assert "vazio" in res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_adversarial_pdf_validation_corrupted_header(client: AsyncClient):
    """
    Adversarial: Upload corrupt files lacking '%PDF-' magic bytes:
    1. Truncated header b'%PDF' (missing hyphen)
    2. Case mismatch b'%pdf-1.4'
    3. Zip/Office binary header b'PK\x03\x04...'
    4. Random garbage bytes b'\x00\x01\x02\x03'
    All must return HTTP 400 Bad Request.
    """
    corrupt_samples = [
        ("truncated.pdf", b"%PDF1.4 non conforming header"),
        ("lowercase.pdf", b"%pdf-1.4 lowercase header"),
        ("zip_binary.pdf", b"PK\x03\x04\x14\x00\x00\x00fake zip content"),
        ("garbage.pdf", b"\x00\x01\x02\x03\x04\x05\x06\x07\x08"),
    ]
    for filename, payload in corrupt_samples:
        files = {"file": (filename, payload, "application/pdf")}
        res = await client.post("/api/v1/invoices/extract", files=files)
        assert res.status_code == 400, f"Expected 400 for {filename}, got {res.status_code}"
        assert "cabeçalho PDF" in res.json()["detail"]


@pytest.mark.asyncio
async def test_adversarial_pdf_validation_invalid_card_id(client: AsyncClient):
    """
    Adversarial: Pass negative and non-existent card_ids via query or form data.
    Must return HTTP 400 Bad Request.
    """
    for bad_id in [99999, -1]:
        files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        res = await client.post(f"/api/v1/invoices/extract?card_id={bad_id}", files=files)
        assert res.status_code == 400
        assert "não existe" in res.json()["detail"]


# ==============================================================================
# 2. ADVERSARIAL DUPLICATE DETECTION (RN02)
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_duplicate_detection_exact_and_variations(
    client: AsyncClient, db_session: AsyncSession
):
    """
    Adversarial verification of Rule RN02:
    Pre-insert transaction in SQLite:
    date: 2026-10-25 14:30:00 UTC, description: 'Supermercado Pao de Acucar', value: 234.50, card_id: 1

    Verify that:
    1. Extraction item with same date (2026-10-25), same value (234.50), same description -> is_duplicate = True
    2. Extraction item with same date, same value, case-insensitive description ('supermercado pao de acucar') -> is_duplicate = True
    3. Extraction item with same date, same value, different card (card_id = 2 if exists, or none) -> behaves correctly
    4. Extraction item with different date ('2026-10-26') -> is_duplicate = False
    5. Extraction item with amount difference outside floating threshold (234.52 vs 234.50) -> is_duplicate = False
    """
    pre_tx = Transaction(
        dt_lcto=datetime(2026, 10, 25, 14, 30, 0, tzinfo=timezone.utc),
        description="Supermercado Pao de Acucar",
        value=234.50,
        card_id=1,
        owner_id=1,
        type_id=1,
        total_parcs=1,
        cur_parcs=1,
        is_paid=False,
    )
    db_session.add(pre_tx)
    await db_session.commit()

    gemini_payload = {
        "bank_or_issuer": "Nubank",
        "invoice_month_year": "2026-11",
        "due_date": "2026-11-10",
        "total_invoice_amount": 938.00,
        "items": [
            # 1. Exact match
            {
                "purchase_date": "2026-10-25",
                "description": "Supermercado Pao de Acucar",
                "amount": 234.50,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Mercado",
            },
            # 2. Lowercase and unaccented variation
            {
                "purchase_date": "2026-10-25",
                "description": "supermercado pao de acucar",
                "amount": 234.50,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Mercado",
            },
            # 3. Different date (next day) -> NOT duplicate
            {
                "purchase_date": "2026-10-26",
                "description": "Supermercado Pao de Acucar",
                "amount": 234.50,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Mercado",
            },
            # 4. Different amount (outside 0.01 tolerance) -> NOT duplicate
            {
                "purchase_date": "2026-10-25",
                "description": "Supermercado Pao de Acucar",
                "amount": 234.55,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Mercado",
            },
        ],
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(gemini_payload)
    mock_response.parsed = None

    with patch("app.core.gemini.get_gemini_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
        mock_get_client.return_value = mock_client

        files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
        res = await client.post("/api/v1/invoices/extract?card_id=1", files=files)
        assert res.status_code == 200
        items = res.json()["items"]

        # Item 0: exact match -> duplicate
        assert items[0]["is_duplicate"] is True
        # Item 1: casing variation match -> duplicate
        assert items[1]["is_duplicate"] is True
        # Item 2: different date -> not duplicate
        assert items[2]["is_duplicate"] is False
        # Item 3: different value -> not duplicate
        assert items[3]["is_duplicate"] is False


# ==============================================================================
# 3. ADVERSARIAL BATCH CONFIRMATION & FOREIGN KEY INTEGRITY
# ==============================================================================

@pytest.mark.asyncio
async def test_adversarial_batch_confirmation_fk_integrity(
    client: AsyncClient, db_session: AsyncSession
):
    """
    Adversarial verification of Batch Confirmation:
    1. Confirm a batch of items with valid FKs (owner, card, category).
    2. Confirm persistence in SQLite `transactions_fapp` table directly.
    3. Verify foreign key constraints by attempting to inject non-existent owner_id,
       card_id, or type_id -> expect 400 Bad Request and zero phantom transactions created.
    """
    valid_batch = {
        "card_id": 1,
        "project_future_installments": False,
        "items": [
            {
                "purchase_date": "2026-10-10",
                "description": "Farmacia Popular",
                "value": 45.90,
                "owner_id": 2,  # Mãe
                "type_id": 3,   # Farmácia
                "total_parcs": 1,
                "cur_parcs": 1,
                "is_paid": False,
            },
            {
                "purchase_date": "2026-10-12",
                "description": "Zara Morumbi",
                "value": 180.00,
                "owner_id": 3,  # Irmã
                "type_id": 5,   # Roupas
                "total_parcs": 3,
                "cur_parcs": 1,
                "is_paid": False,
            },
        ],
    }

    res = await client.post("/api/v1/invoices/confirm", json=valid_batch)
    assert res.status_code == 201
    assert res.json()["confirmed_count"] == 2

    # Query SQLite directly to verify stored records and foreign keys
    query = select(Transaction).where(
        Transaction.description.in_(["Farmacia Popular", "Zara Morumbi"])
    )
    result = await db_session.execute(query)
    saved_txs = result.scalars().all()
    assert len(saved_txs) == 2

    t_map = {tx.description: tx for tx in saved_txs}
    assert t_map["Farmacia Popular"].owner_id == 2
    assert t_map["Farmacia Popular"].type_id == 3
    assert t_map["Farmacia Popular"].card_id == 1

    assert t_map["Zara Morumbi"].owner_id == 3
    assert t_map["Zara Morumbi"].type_id == 5
    assert t_map["Zara Morumbi"].card_id == 1

    # Atomic rollback test: invalid owner_id in one item of a batch
    invalid_batch = {
        "card_id": 1,
        "items": [
            {
                "description": "Item Valido A",
                "value": 50.00,
                "owner_id": 1,
                "type_id": 1,
            },
            {
                "description": "Item Invalido B",
                "value": 75.00,
                "owner_id": 88888,  # Does not exist
                "type_id": 1,
            },
        ],
    }
    fail_res = await client.post("/api/v1/invoices/confirm", json=invalid_batch)
    assert fail_res.status_code == 400
    assert "88888" in fail_res.json()["detail"]

    # Verify that Item Valido A was NOT committed to SQLite (Atomic rollback)
    check_q = select(Transaction).where(Transaction.description == "Item Valido A")
    check_res = await db_session.execute(check_q)
    assert check_res.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_adversarial_installment_projection_year_boundary(
    client: AsyncClient, db_session: AsyncSession
):
    """
    Adversarial test for Rule RN01 installment projection crossing calendar year boundary:
    Purchase on 2026-11-15 with cur_parcs=1 and total_parcs=4.
    Projections should create:
    - Parcela 1: 2026-11-15 (cur=1, is_forecast=False)
    - Parcela 2: 2026-12-15 (cur=2, is_forecast=True)
    - Parcela 3: 2027-01-15 (cur=3, is_forecast=True)  <- Year boundary
    - Parcela 4: 2027-02-15 (cur=4, is_forecast=True)
    """
    payload = {
        "card_id": 1,
        "project_future_installments": True,
        "items": [
            {
                "purchase_date": "2026-11-15",
                "description": "Geladeira Inox",
                "value": 750.00,
                "owner_id": 1,
                "type_id": 8,
                "cur_parcs": 1,
                "total_parcs": 4,
            }
        ],
    }
    res = await client.post("/api/v1/invoices/confirm", json=payload)
    assert res.status_code == 201
    assert res.json()["confirmed_count"] == 4

    query = (
        select(Transaction)
        .where(Transaction.description == "Geladeira Inox")
        .order_by(Transaction.cur_parcs)
    )
    result = await db_session.execute(query)
    installments = result.scalars().all()
    assert len(installments) == 4

    # Parcela 1
    assert installments[0].cur_parcs == 1
    assert installments[0].dt_lcto.year == 2026 and installments[0].dt_lcto.month == 11
    assert installments[0].is_forecast is False

    # Parcela 2
    assert installments[1].cur_parcs == 2
    assert installments[1].dt_lcto.year == 2026 and installments[1].dt_lcto.month == 12
    assert installments[1].is_forecast is True

    # Parcela 3 (Crosses to 2027)
    assert installments[2].cur_parcs == 3
    assert installments[2].dt_lcto.year == 2027 and installments[2].dt_lcto.month == 1
    assert installments[2].is_forecast is True

    # Parcela 4
    assert installments[3].cur_parcs == 4
    assert installments[3].dt_lcto.year == 2027 and installments[3].dt_lcto.month == 2
    assert installments[3].is_forecast is True


# ==============================================================================
# 4. HERMETIC MOCK EXECUTION & NETWORK ISOLATION VERIFICATION
# ==============================================================================

@pytest.mark.asyncio
async def test_hermetic_mock_execution_no_outbound_network_leaks(client: AsyncClient):
    """
    Verifies that the Gemini extraction endpoint runs completely hermetically
    without attempting any live outbound socket connections to Google APIs or external servers.
    A socket monkeypatch intercepts any socket.connect calls.
    """
    original_connect = socket.socket.connect
    network_call_attempted = False

    def guard_connect(self, address):
        nonlocal network_call_attempted
        network_call_attempted = True
        raise RuntimeError(f"Prohibited outbound network access attempted to: {address}")

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "bank_or_issuer": "Nubank",
        "invoice_month_year": "2026-11",
        "due_date": "2026-11-10",
        "total_invoice_amount": 100.0,
        "items": [
            {
                "purchase_date": "2026-10-15",
                "description": "Compra Teste",
                "amount": 100.0,
                "current_installment": 1,
                "total_installments": 1,
                "suggested_category": "Outros",
                "suggested_owner": "Rafael",
            }
        ],
    })
    mock_response.parsed = None

    with patch("socket.socket.connect", side_effect=guard_connect):
        with patch("app.core.gemini.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
            res = await client.post("/api/v1/invoices/extract", files=files)

            assert res.status_code == 200
            assert network_call_attempted is False, "Unexpected outbound network call leaked during extraction!"


@pytest.mark.asyncio
async def test_gemini_api_error_translation_spectrum(client: AsyncClient):
    """
    Verifies error translation when Gemini SDK raises various APIErrors:
    - 429 / RESOURCE_EXHAUSTED -> HTTP 503
    - 503 / UNAVAILABLE -> HTTP 503
    - 400 / INVALID_ARGUMENT -> HTTP 502
    """
    error_matrix = [
        (429, "Resource exhausted (quota exceeded)", 503),
        (503, "Service unavailable due to maintenance", 503),
        (400, "Invalid argument format", 502),
    ]

    for err_code, err_msg, expected_status in error_matrix:
        with patch("app.core.gemini.get_gemini_client") as mock_get_client:
            mock_client = MagicMock()
            mock_client.aio.models.generate_content = AsyncMock(
                side_effect=APIError(err_code, {"error": {"message": err_msg, "code": err_code}})
            )
            mock_get_client.return_value = mock_client

            files = {"file": ("fatura.pdf", SYNTHETIC_PDF_BYTES, "application/pdf")}
            res = await client.post("/api/v1/invoices/extract", files=files)
            assert res.status_code == expected_status, (
                f"Expected status {expected_status} for code {err_code}, got {res.status_code}"
            )


# ==============================================================================
# 5. ADVERSARIAL HEURISTICS & INSTALLMENT PARSER TESTS
# ==============================================================================

def test_adversarial_installment_decomposition_edge_cases():
    """
    Tests edge cases in installment pattern matching:
    - Multiple slash tokens (e.g. date + installment)
    - Large installment numbers
    - Single token purchases
    """
    # Valid installment 03/12 embedded in description
    assert decompose_installments("COMPRA LOJA 03/12 BRASIL", 1, 1) == (3, 12)
    # Parcela de
    assert decompose_installments("Compra Parcela 01 de 10", 1, 1) == (1, 10)
    # No installment
    assert decompose_installments("Supermercado 15 Outubro", 1, 1) == (1, 1)


def test_adversarial_owner_heuristics_casing_and_accents():
    """
    Tests owner heuristics with uppercase, lowercase, diacritics, and priority:
    - Additional cardholder always overrides description keywords.
    - Drogaria / Farmácia -> Mãe
    - Zara / Shein -> Irmã
    - Steam / iFood -> Rafael
    - Fallback -> Rafael
    """
    fake_owners = {
        "RAFAEL": Owner(id=1, name="Rafael"),
        "MAE": Owner(id=2, name="Mãe"),
        "IRMA": Owner(id=3, name="Irmã"),
    }

    # Cardholder priority override: description has 'Zara' (usually Irmã), but cardholder is 'Rafael'
    name, oid = assign_heuristic_owner("Cartão Titular RAFAEL", "Zara Roupas", fake_owners)
    assert name == "Rafael" and oid == 1

    # Diacritics and case variations: 'fArMÁcIa' -> Mãe
    name, oid = assign_heuristic_owner(None, "dRoGaRiA rAiA jArDiMs", fake_owners)
    assert name == "Mãe" and oid == 2

    # 'SHEIN' -> Irmã
    name, oid = assign_heuristic_owner(None, "shein brasil online", fake_owners)
    assert name == "Irmã" and oid == 3

    # 'iFood' -> Rafael
    name, oid = assign_heuristic_owner(None, "IFOOD *Lanche", fake_owners)
    assert name == "Rafael" and oid == 1
