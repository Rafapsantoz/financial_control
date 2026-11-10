import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_macro_projection(client: AsyncClient):
    res = await client.get("/api/v1/planning/macro-projection?year=2026&account_balance=16638.40")
    assert res.status_code == 200
    data = res.json()
    assert data["year"] == 2026
    assert data["account_balance"] == 16638.40
    assert len(data["months"]) == 12
    assert "runway" in data
    assert data["runway"]["months_of_runway"] >= 0
    assert isinstance(data["fixed_expenses"], list)
    assert len(data["card_expenses"]) > 0


@pytest.mark.asyncio
async def test_goals_crud_lifecycle(client: AsyncClient):
    # 1. List seeded goals
    res = await client.get("/api/v1/planning/goals")
    assert res.status_code == 200
    initial_goals = res.json()
    assert isinstance(initial_goals, list)

    # 2. Create goal
    new_goal = {
        "title": "Aspirador Vertical",
        "target_amount": 400.0,
        "saved_amount": 100.0,
        "category": "Essencial",
        "priority": "Alta",
        "comment": "Uso diário para sala",
    }
    create_res = await client.post("/api/v1/planning/goals", json=new_goal)
    assert create_res.status_code == 201
    created = create_res.json()
    goal_id = created["id"]
    assert created["title"] == "Aspirador Vertical"

    # 3. Update goal
    update_res = await client.put(
        f"/api/v1/planning/goals/{goal_id}",
        json={"saved_amount": 400.0, "is_completed": True},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["saved_amount"] == 400.0
    assert updated["is_completed"] is True

    # 4. Delete goal
    del_res = await client.delete(f"/api/v1/planning/goals/{goal_id}")
    assert del_res.status_code == 200


@pytest.mark.asyncio
async def test_get_scenarios(client: AsyncClient):
    res = await client.get("/api/v1/planning/scenarios")
    assert res.status_code == 200
    scenarios = res.json()
    assert len(scenarios) >= 3
    cities = [s["city"] for s in scenarios]
    assert "Brodowski" in cities
    assert "Ribeirão Preto" in cities


@pytest.mark.asyncio
async def test_get_financial_principles(client: AsyncClient):
    res = await client.get("/api/v1/planning/principles")
    assert res.status_code == 200
    principles = res.json()
    assert len(principles) == 15
    assert principles[0]["step"] == 1
    assert principles[10]["title"] == "Regra das 72 Horas"
