import pytest
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_health_and_root(client):
    r_root = await client.get("/")
    assert r_root.status_code == 200
    assert r_root.json()["status"] == "ok"

    r_health = await client.get("/health")
    assert r_health.status_code == 200
    assert r_health.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_list_seeded_owners(client):
    res = await client.get("/api/v1/owners")
    assert res.status_code == 200
    data = res.json()
    names = [o["name"] for o in data]
    assert "Rafael" in names
    assert "Mãe" in names
    assert "Irmã" in names


@pytest.mark.asyncio
async def test_create_and_get_owner(client):
    # Create new owner
    payload = {"name": "Tio Bob", "category": "Familiar", "phone_number": "11999999999"}
    res = await client.post("/api/v1/owners", json=payload)
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["name"] == "Tio Bob"

    # Get by ID
    get_res = await client.get(f"/api/v1/owners/{created['id']}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Tio Bob"


@pytest.mark.asyncio
async def test_create_owner_duplicate_conflict(client):
    payload = {"name": "Rafael"}
    res = await client.post("/api/v1/owners", json=payload)
    assert res.status_code == 409
    assert "já existe" in res.json()["detail"]


@pytest.mark.asyncio
async def test_update_owner(client):
    payload = {"name": "Primo", "category": "Familiar"}
    res = await client.post("/api/v1/owners", json=payload)
    owner_id = res.json()["id"]

    update_res = await client.put(f"/api/v1/owners/{owner_id}", json={"name": "Primo Atualizado"})
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Primo Atualizado"


@pytest.mark.asyncio
async def test_delete_owner_without_transactions(client):
    payload = {"name": "Sobrinho"}
    res = await client.post("/api/v1/owners", json=payload)
    owner_id = res.json()["id"]

    del_res = await client.delete(f"/api/v1/owners/{owner_id}")
    assert del_res.status_code == 200

    get_res = await client.get(f"/api/v1/owners/{owner_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_list_seeded_categories(client):
    res = await client.get("/api/v1/categories")
    assert res.status_code == 200
    data = res.json()
    descriptions = [c["description"] for c in data]
    assert len(descriptions) >= 8
    assert "Mercado" in descriptions
    assert "Farmácia" in descriptions
    assert "Assinaturas" in descriptions


@pytest.mark.asyncio
async def test_create_and_update_category(client):
    payload = {"description": "Educação"}
    res = await client.post("/api/v1/categories", json=payload)
    assert res.status_code == 201
    cat_id = res.json()["id"]

    up_res = await client.put(f"/api/v1/categories/{cat_id}", json={"description": "Cursos"})
    assert up_res.status_code == 200
    assert up_res.json()["description"] == "Cursos"


@pytest.mark.asyncio
async def test_create_category_duplicate_conflict(client):
    payload = {"description": "Mercado"}
    res = await client.post("/api/v1/categories", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_list_seeded_cards(client):
    res = await client.get("/api/v1/cards")
    assert res.status_code == 200
    data = res.json()
    card_names = [c["card_name"] for c in data]
    assert "Nubank" in card_names


@pytest.mark.asyncio
async def test_create_and_update_card(client):
    payload = {"card_name": "Inter Black", "due_day": 10, "total_limit": 10000.0}
    res = await client.post("/api/v1/cards", json=payload)
    assert res.status_code == 201
    card_id = res.json()["id"]
    assert res.json()["due_day"] == 10

    up_res = await client.put(f"/api/v1/cards/{card_id}", json={"due_day": 25, "total_limit": 15000.0})
    assert up_res.status_code == 200
    assert up_res.json()["due_day"] == 25
    assert up_res.json()["total_limit"] == 15000.0


@pytest.mark.asyncio
async def test_create_card_duplicate_conflict(client):
    payload = {"card_name": "Nubank"}
    res = await client.post("/api/v1/cards", json=payload)
    assert res.status_code == 409


@pytest.mark.asyncio
async def test_create_transaction_success(client):
    # Fetch seeded IDs
    owners = (await client.get("/api/v1/owners")).json()
    cards = (await client.get("/api/v1/cards")).json()
    categories = (await client.get("/api/v1/categories")).json()

    owner_id = owners[0]["id"]
    card_id = cards[0]["id"]
    type_id = categories[0]["id"]

    tx_data = {
        "dt_lcto": datetime.now(timezone.utc).isoformat(),
        "description": "Supermercado Pão de Açúcar",
        "value": 154.50,
        "owner_id": owner_id,
        "card_id": card_id,
        "type_id": type_id,
        "total_parcs": 3,
        "cur_parcs": 1,
        "comment": "Compras semanais",
        "is_paid": False,
        "is_forecast": False,
    }

    res = await client.post("/api/v1/transactions", json=tx_data)
    assert res.status_code == 201
    created = res.json()
    assert created["id"] > 0
    assert created["value"] == 154.50
    assert created["cur_parcs"] == 1
    assert created["total_parcs"] == 3


@pytest.mark.asyncio
async def test_create_transaction_invalid_foreign_keys(client):
    tx_bad_owner = {
        "description": "Test",
        "value": 50.0,
        "owner_id": 99999,
    }
    r1 = await client.post("/api/v1/transactions", json=tx_bad_owner)
    assert r1.status_code == 400
    assert "Proprietário com ID 99999 não existe" in r1.json()["detail"]

    tx_bad_card = {
        "description": "Test",
        "value": 50.0,
        "card_id": 99999,
    }
    r2 = await client.post("/api/v1/transactions", json=tx_bad_card)
    assert r2.status_code == 400
    assert "Cartão com ID 99999 não existe" in r2.json()["detail"]

    tx_bad_type = {
        "description": "Test",
        "value": 50.0,
        "type_id": 99999,
    }
    r3 = await client.post("/api/v1/transactions", json=tx_bad_type)
    assert r3.status_code == 400
    assert "Categoria com ID 99999 não existe" in r3.json()["detail"]


@pytest.mark.asyncio
async def test_create_transaction_invalid_installments(client):
    bad_installments = {
        "description": "Inconsistent installments",
        "value": 100.0,
        "cur_parcs": 5,
        "total_parcs": 2,
    }
    res = await client.post("/api/v1/transactions", json=bad_installments)
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_list_transactions_with_month_filter(client):
    # Insert one transaction in 2026-11 and one in 2026-12
    tx1 = {
        "dt_lcto": "2026-11-10T12:00:00Z",
        "description": "Novembro Compra",
        "value": 100.0,
    }
    tx2 = {
        "dt_lcto": "2026-12-15T12:00:00Z",
        "description": "Dezembro Compra",
        "value": 200.0,
    }
    r1 = await client.post("/api/v1/transactions", json=tx1)
    r2 = await client.post("/api/v1/transactions", json=tx2)
    assert r1.status_code == 201
    assert r2.status_code == 201

    # Filter by 2026-11
    res_nov = await client.get("/api/v1/transactions?month=2026-11")
    assert res_nov.status_code == 200
    data_nov = res_nov.json()
    assert any(t["description"] == "Novembro Compra" for t in data_nov)
    assert not any(t["description"] == "Dezembro Compra" for t in data_nov)

    # Filter by 2026-12
    res_dec = await client.get("/api/v1/transactions?month=2026-12")
    assert res_dec.status_code == 200
    data_dec = res_dec.json()
    assert any(t["description"] == "Dezembro Compra" for t in data_dec)
    assert not any(t["description"] == "Novembro Compra" for t in data_dec)


@pytest.mark.asyncio
async def test_update_transaction(client):
    tx = {
        "description": "Original",
        "value": 50.0,
        "total_parcs": 2,
        "cur_parcs": 1,
    }
    res = await client.post("/api/v1/transactions", json=tx)
    tx_id = res.json()["id"]

    up = await client.put(f"/api/v1/transactions/{tx_id}", json={"description": "Modificado", "cur_parcs": 2})
    assert up.status_code == 200
    assert up.json()["description"] == "Modificado"
    assert up.json()["cur_parcs"] == 2


@pytest.mark.asyncio
async def test_toggle_paid_status(client):
    tx = {
        "description": "Toggle Test",
        "value": 75.0,
        "is_paid": False,
    }
    res = await client.post("/api/v1/transactions", json=tx)
    tx_id = res.json()["id"]
    assert res.json()["is_paid"] is False

    # Toggle to True
    t1 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert t1.status_code == 200
    assert t1.json()["is_paid"] is True

    # Toggle back to False
    t2 = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert t2.status_code == 200
    assert t2.json()["is_paid"] is False


@pytest.mark.asyncio
async def test_delete_owner_with_active_transaction_fails(client):
    owners = (await client.get("/api/v1/owners")).json()
    owner_id = owners[0]["id"]

    # Create transaction with this owner
    tx = {"description": "Linked Transaction", "value": 30.0, "owner_id": owner_id}
    await client.post("/api/v1/transactions", json=tx)

    # Attempt to delete owner -> must return 409
    del_res = await client.delete(f"/api/v1/owners/{owner_id}")
    assert del_res.status_code == 409
    assert "transações vinculadas" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_card_with_active_transaction_fails(client):
    cards = (await client.get("/api/v1/cards")).json()
    card_id = cards[0]["id"]

    tx = {"description": "Card Linked", "value": 45.0, "card_id": card_id}
    await client.post("/api/v1/transactions", json=tx)

    del_res = await client.delete(f"/api/v1/cards/{card_id}")
    assert del_res.status_code == 409
    assert "transações vinculadas" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_category_with_active_transaction_fails(client):
    categories = (await client.get("/api/v1/categories")).json()
    cat_id = categories[0]["id"]

    tx = {"description": "Category Linked", "value": 60.0, "type_id": cat_id}
    await client.post("/api/v1/transactions", json=tx)

    del_res = await client.delete(f"/api/v1/categories/{cat_id}")
    assert del_res.status_code == 409
    assert "transações vinculadas" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_delete_transaction(client):
    tx = {"description": "To be deleted", "value": 10.0}
    res = await client.post("/api/v1/transactions", json=tx)
    tx_id = res.json()["id"]

    del_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 200

    get_res = await client.get(f"/api/v1/transactions/{tx_id}")
    assert get_res.status_code == 404
