import pytest
from datetime import datetime, timezone


# ==============================================================================
# 1. DUPLICATE OWNER CREATION & CASING ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_duplicate_owner_exact_and_casing(client):
    """
    Test duplicate owner creation with exact match and casing variations:
    'Rafael', 'rafael ', 'RAFAEL', '  rAfAeL  ' -> expect 409 Conflict.
    """
    variations = [
        "Rafael",
        "rafael",
        "RAFAEL",
        "rafael ",
        "  rafael  ",
        "  RAFAEL  ",
        "rAfAeL",
    ]
    for name_var in variations:
        res = await client.post("/api/v1/owners", json={"name": name_var})
        assert res.status_code == 409, f"Expected 409 for name variation '{name_var}', got {res.status_code}"
        assert "já existe" in res.json()["detail"]


@pytest.mark.asyncio
async def test_owner_empty_and_whitespace_rejection(client):
    """
    Test that empty and whitespace-only owner names are rejected with 422 Unprocessable Entity.
    """
    for bad_name in ["", "   ", "\t", "\n"]:
        res = await client.post("/api/v1/owners", json={"name": bad_name})
        assert res.status_code == 422, f"Expected 422 for name '{bad_name}', got {res.status_code}"


@pytest.mark.asyncio
async def test_update_owner_duplicate_conflict(client):
    """
    Updating an owner to another existing owner's name (case-insensitive)
    must fail with 409 Conflict.
    Updating to own name with different case should succeed.
    """
    # Create two unique owners
    res1 = await client.post("/api/v1/owners", json={"name": "Alice"})
    assert res1.status_code == 201
    id1 = res1.json()["id"]

    res2 = await client.post("/api/v1/owners", json={"name": "Bob"})
    assert res2.status_code == 201
    id2 = res2.json()["id"]

    # Try renaming Bob to Alice (case variations)
    conflict_res = await client.put(f"/api/v1/owners/{id2}", json={"name": "alice"})
    assert conflict_res.status_code == 409
    assert "já existe" in conflict_res.json()["detail"]

    # Rename Alice to ALICE (own name, case change) -> should be allowed
    self_res = await client.put(f"/api/v1/owners/{id1}", json={"name": "ALICE"})
    assert self_res.status_code == 200
    assert self_res.json()["name"] == "ALICE"


# ==============================================================================
# 2. INVALID INSTALLMENTS ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_transaction_invalid_installments_rejection(client):
    """
    Test invalid installment bounds:
    - cur_parcs > total_parcs (e.g. cur_parcs=5, total_parcs=3) -> 422
    - cur_parcs <= 0 (e.g. 0, -1) -> 422
    - total_parcs <= 0 (e.g. 0, -1) -> 422
    """
    invalid_cases = [
        {"cur_parcs": 5, "total_parcs": 3},
        {"cur_parcs": 2, "total_parcs": 1},
        {"cur_parcs": 0, "total_parcs": 1},
        {"cur_parcs": 1, "total_parcs": 0},
        {"cur_parcs": -1, "total_parcs": 5},
        {"cur_parcs": 1, "total_parcs": -5},
    ]
    for case in invalid_cases:
        payload = {
            "description": "Installment Test",
            "value": 100.0,
            **case,
        }
        res = await client.post("/api/v1/transactions", json=payload)
        assert res.status_code == 422, f"Expected 422 for installments {case}, got {res.status_code}"


@pytest.mark.asyncio
async def test_transaction_installment_boundaries_valid(client):
    """
    Test valid installment boundaries:
    - 1/1 (à vista)
    - 10/10 (last installment)
    """
    for cur, tot in [(1, 1), (10, 10), (1, 12)]:
        payload = {
            "description": f"Valid parcs {cur}/{tot}",
            "value": 50.0,
            "cur_parcs": cur,
            "total_parcs": tot,
        }
        res = await client.post("/api/v1/transactions", json=payload)
        assert res.status_code == 201, f"Expected 201 for {cur}/{tot}, got {res.status_code}"
        assert res.json()["cur_parcs"] == cur
        assert res.json()["total_parcs"] == tot


@pytest.mark.asyncio
async def test_update_transaction_installment_inconsistency(client):
    """
    Test updating single installment fields that result in cur_parcs > total_parcs:
    - Start with cur=1, tot=3. Update cur=4 -> expect 400 Bad Request.
    - Start with cur=2, tot=2. Update tot=1 -> expect 400 Bad Request.
    """
    # Create transaction with 1/3
    res = await client.post(
        "/api/v1/transactions",
        json={"description": "Cross update test", "value": 75.0, "cur_parcs": 1, "total_parcs": 3},
    )
    assert res.status_code == 201
    tx_id = res.json()["id"]

    # Try setting cur_parcs to 4 (without changing total_parcs=3)
    up1 = await client.put(f"/api/v1/transactions/{tx_id}", json={"cur_parcs": 4})
    assert up1.status_code == 400
    assert "não pode ser maior" in up1.json()["detail"]

    # Now create transaction with 2/2
    res2 = await client.post(
        "/api/v1/transactions",
        json={"description": "Cross update test 2", "value": 80.0, "cur_parcs": 2, "total_parcs": 2},
    )
    assert res2.status_code == 201
    tx_id2 = res2.json()["id"]

    # Try setting total_parcs to 1 (while cur_parcs is 2)
    up2 = await client.put(f"/api/v1/transactions/{tx_id2}", json={"total_parcs": 1})
    assert up2.status_code == 400
    assert "não pode ser maior" in up2.json()["detail"]


# ==============================================================================
# 3. NEGATIVE OR ZERO VALUE TRANSACTION ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_transaction_negative_or_zero_values(client):
    """
    Transactions must enforce value > 0.0:
    - value = 0.0 -> 422
    - value = -10.50 -> 422
    - value = -0.001 -> 422
    """
    bad_values = [0.0, -0.01, -1.0, -150.0, -999999.99]
    for val in bad_values:
        res = await client.post(
            "/api/v1/transactions",
            json={"description": "Bad Value", "value": val},
        )
        assert res.status_code == 422, f"Expected 422 for value {val}, got {res.status_code}"


@pytest.mark.asyncio
async def test_update_transaction_negative_or_zero_value(client):
    """
    Updating an existing transaction to negative or zero value must fail with 422.
    """
    res = await client.post("/api/v1/transactions", json={"description": "Valid Tx", "value": 50.0})
    assert res.status_code == 201
    tx_id = res.json()["id"]

    for bad_val in [0.0, -10.0]:
        up_res = await client.put(f"/api/v1/transactions/{tx_id}", json={"value": bad_val})
        assert up_res.status_code == 422, f"Expected 422 for update value {bad_val}, got {up_res.status_code}"


@pytest.mark.asyncio
async def test_transaction_value_rounding_and_precision(client):
    """
    Ensure value rounding rounds to 2 decimal places properly:
    10.126 -> 10.13
    """
    res = await client.post(
        "/api/v1/transactions",
        json={"description": "Rounding Check", "value": 10.126},
    )
    assert res.status_code == 201
    assert res.json()["value"] == 10.13


# ==============================================================================
# 4. NON-EXISTENT FOREIGN KEYS ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_create_transaction_nonexistent_fks(client):
    """
    Test non-existent foreign keys:
    - owner_id = 9999 -> 400 Bad Request
    - card_id = 9999 -> 400 Bad Request
    - type_id = 9999 -> 400 Bad Request
    - negative ids -> 400 Bad Request
    """
    for bad_fk, field in [(9999, "owner_id"), (9999, "card_id"), (9999, "type_id"), (-1, "owner_id")]:
        payload = {"description": f"FK test {field}", "value": 25.0, field: bad_fk}
        res = await client.post("/api/v1/transactions", json=payload)
        assert res.status_code == 400, f"Expected 400 for {field}={bad_fk}, got {res.status_code}"
        assert "não existe" in res.json()["detail"]


@pytest.mark.asyncio
async def test_update_transaction_nonexistent_fks(client):
    """
    Updating an existing transaction with invalid foreign keys must fail with 400.
    """
    res = await client.post("/api/v1/transactions", json={"description": "Valid Tx", "value": 20.0})
    assert res.status_code == 201
    tx_id = res.json()["id"]

    for bad_fk, field in [(8888, "owner_id"), (8888, "card_id"), (8888, "type_id")]:
        up_res = await client.put(f"/api/v1/transactions/{tx_id}", json={field: bad_fk})
        assert up_res.status_code == 400, f"Expected 400 for update {field}={bad_fk}, got {up_res.status_code}"
        assert "não existe" in up_res.json()["detail"]


# ==============================================================================
# 5. CASCADE DELETION PROTECTION ADVERSARIAL TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_owner_cascade_deletion_protection(client):
    """
    Test cascade deletion protection:
    1. Create an owner.
    2. Create a transaction for that owner.
    3. Try deleting that owner -> expect 409 Conflict.
    4. Verify owner and transaction still exist.
    5. Delete the transaction.
    6. Delete owner -> expect 200 OK.
    """
    # 1. Create owner
    o_res = await client.post("/api/v1/owners", json={"name": "Owner Cascade Test"})
    assert o_res.status_code == 201
    owner_id = o_res.json()["id"]

    # 2. Create transaction referencing this owner
    t_res = await client.post(
        "/api/v1/transactions",
        json={"description": "Owner cascade tx", "value": 120.0, "owner_id": owner_id},
    )
    assert t_res.status_code == 201
    tx_id = t_res.json()["id"]

    # 3. Attempt delete owner -> expect 409 Conflict
    del_owner_res = await client.delete(f"/api/v1/owners/{owner_id}")
    assert del_owner_res.status_code == 409
    assert "transações vinculadas" in del_owner_res.json()["detail"]

    # 4. Verify owner and transaction still exist
    get_owner = await client.get(f"/api/v1/owners/{owner_id}")
    assert get_owner.status_code == 200
    get_tx = await client.get(f"/api/v1/transactions/{tx_id}")
    assert get_tx.status_code == 200

    # 5. Delete transaction
    del_tx_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_tx_res.status_code == 200

    # 6. Now delete owner -> expect 200 OK
    del_owner_again = await client.delete(f"/api/v1/owners/{owner_id}")
    assert del_owner_again.status_code == 200

    # Verify owner is deleted
    assert (await client.get(f"/api/v1/owners/{owner_id}")).status_code == 404


@pytest.mark.asyncio
async def test_card_and_category_cascade_deletion_protection(client):
    """
    Test cascade protection for Cards and Categories as well.
    """
    # Card protection
    c_res = await client.post("/api/v1/cards", json={"card_name": "Card Cascade Test"})
    assert c_res.status_code == 201
    card_id = c_res.json()["id"]

    t_res1 = await client.post(
        "/api/v1/transactions",
        json={"description": "Card tx", "value": 50.0, "card_id": card_id},
    )
    assert t_res1.status_code == 201
    tx_id1 = t_res1.json()["id"]

    del_card = await client.delete(f"/api/v1/cards/{card_id}")
    assert del_card.status_code == 409

    # Category protection
    cat_res = await client.post("/api/v1/categories", json={"description": "Cat Cascade Test"})
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    t_res2 = await client.post(
        "/api/v1/transactions",
        json={"description": "Cat tx", "value": 50.0, "type_id": cat_id},
    )
    assert t_res2.status_code == 201
    tx_id2 = t_res2.json()["id"]

    del_cat = await client.delete(f"/api/v1/categories/{cat_id}")
    assert del_cat.status_code == 409

    # Cleanup transactions and then delete card and cat
    await client.delete(f"/api/v1/transactions/{tx_id1}")
    await client.delete(f"/api/v1/transactions/{tx_id2}")

    assert (await client.delete(f"/api/v1/cards/{card_id}")).status_code == 200
    assert (await client.delete(f"/api/v1/categories/{cat_id}")).status_code == 200


# ==============================================================================
# 6. TOGGLE-PAID ENDPOINT IDEMPOTENCY AND STATE PERSISTENCE
# ==============================================================================

@pytest.mark.asyncio
async def test_toggle_paid_cycle_and_persistence(client):
    """
    Test toggle-paid endpoint:
    - Inversion from False -> True
    - DB persistence confirmed via GET /{id}
    - Inversion from True -> False
    - DB persistence confirmed via GET /{id}
    - Inversion on 404 non-existent transaction
    """
    # Create with is_paid = False
    tx_res = await client.post(
        "/api/v1/transactions",
        json={"description": "Toggle State Test", "value": 150.0, "is_paid": False},
    )
    assert tx_res.status_code == 201
    tx_id = tx_res.json()["id"]
    assert tx_res.json()["is_paid"] is False

    # 1st Toggle -> True
    t1 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert t1.status_code == 200
    assert t1.json()["is_paid"] is True

    # Confirm persistence in DB
    g1 = await client.get(f"/api/v1/transactions/{tx_id}")
    assert g1.status_code == 200
    assert g1.json()["is_paid"] is True

    # 2nd Toggle -> False
    t2 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert t2.status_code == 200
    assert t2.json()["is_paid"] is False

    # Confirm persistence in DB
    g2 = await client.get(f"/api/v1/transactions/{tx_id}")
    assert g2.status_code == 200
    assert g2.json()["is_paid"] is False

    # 3rd Toggle -> True
    t3 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert t3.status_code == 200
    assert t3.json()["is_paid"] is True

    # Toggle non-existent ID -> 404
    t_nonexistent = await client.patch("/api/v1/transactions/99999/toggle-paid")
    assert t_nonexistent.status_code == 404


# ==============================================================================
# 7. QUERY FILTERS & VALIDATION BOUNDARY STRESS TESTS
# ==============================================================================

@pytest.mark.asyncio
async def test_transaction_month_query_regex_validation(client):
    """
    Month filter format must strictly follow YYYY-MM regex:
    - '2026-11' -> 200
    - '2026-13' -> 422
    - '2026-00' -> 422
    - '2026/11' -> 422
    - 'invalid' -> 422
    """
    ok_res = await client.get("/api/v1/transactions?month=2026-11")
    assert ok_res.status_code == 200

    bad_months = ["2026-13", "2026-00", "2026/11", "2026-1", "invalid", "2026-11-04"]
    for bad_m in bad_months:
        res = await client.get(f"/api/v1/transactions?month={bad_m}")
        assert res.status_code == 422, f"Expected 422 for month filter '{bad_m}', got {res.status_code}"


@pytest.mark.asyncio
async def test_transaction_pagination_bounds(client):
    """
    Pagination boundaries:
    - skip < 0 -> 422
    - limit < 1 -> 422
    - limit > 1000 -> 422
    - valid limits -> 200
    """
    assert (await client.get("/api/v1/transactions?skip=-1")).status_code == 422
    assert (await client.get("/api/v1/transactions?limit=0")).status_code == 422
    assert (await client.get("/api/v1/transactions?limit=1001")).status_code == 422

    assert (await client.get("/api/v1/transactions?skip=0&limit=1")).status_code == 200
    assert (await client.get("/api/v1/transactions?skip=10&limit=100")).status_code == 200
