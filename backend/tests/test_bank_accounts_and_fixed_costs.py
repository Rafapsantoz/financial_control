import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_category_fixed_cost_lifecycle(client: AsyncClient):
    """Testa cadastro e somatória de custos fixos por categoria."""
    # 1. Obter categorias existentes
    cats_res = await client.get("/api/v1/categories")
    assert cats_res.status_code == 200
    cats = cats_res.json()
    assert len(cats) > 0

    first_cat = cats[0]
    cat_id = first_cat["id"]

    # 2. Atualizar fixed_cost da categoria
    update_res = await client.put(
        f"/api/v1/categories/{cat_id}",
        json={"fixed_cost": 1250.50},
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["fixed_cost"] == 1250.50

    # 3. Testar endpoint de resumo de custos fixos
    summary_res = await client.get("/api/v1/categories/summary/fixed-costs")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_fixed_cost"] >= 1250.50
    assert summary["count_with_fixed"] >= 1


@pytest.mark.asyncio
async def test_bank_account_and_cdi_yield_formula(client: AsyncClient):
    """
    Testa o cadastro de contas bancárias de forma separada, com % CDI informada manualmente,
    e a fórmula do rendimento retido pelo Rafael:
    Tot * rendimento - total de outros.
    """
    # 1. Carregar membros cadastrados para obter os IDs do Rafael e da Mãe
    owners_res = await client.get("/api/v1/owners")
    assert owners_res.status_code == 200
    owners = owners_res.json()
    rafael = next((o for o in owners if "rafael" in o["name"].lower()), owners[0])
    mae = next((o for o in owners if "mãe" in o["name"].lower() or "mae" in o["name"].lower()), owners[1] if len(owners) > 1 else owners[0])

    # 2. Criar conta bancária Nubank Reserva com CDI manual (ex: 100% CDI, taxa mensal 0.85%)
    acc_payload = {
        "name": "Nubank Reserva CDI",
        "account_type": "Conta Pagamento / CDI",
        "cdi_rate": 100.0,
        "cdi_monthly_rate": 0.85,
        "notes": "Conta com saldo dividido entre Rafael e Mãe",
        "initial_balances": [
            {"owner_id": rafael["id"], "balance": 7000.0},
            {"owner_id": mae["id"], "balance": 3000.0},
        ],
    }
    create_res = await client.post("/api/v1/bank-accounts", json=acc_payload)
    assert create_res.status_code == 201
    created = create_res.json()
    acc_id = created["id"]
    assert created["name"] == "Nubank Reserva CDI"
    assert created["cdi_monthly_rate"] == 0.85

    # 3. Validar a matemática dos saldos e a fórmula do usuário:
    # Tot = 7000 + 3000 = 10000.0
    # Rendimento mensal = 10000 * 0.85% = 85.00
    # Total outros (Mãe) = 3000.0
    # Saldo próprio Rafael = 7000.0
    # Net com rendimento retido pelo Rafael = 7000.0 + 85.0 = 7085.00
    assert created["total_balance"] == 10000.0
    assert created["others_balance"] == 3000.0
    assert created["owner_balance"] == 7000.0
    assert created["monthly_yield"] == 85.0
    assert created["net_with_yield"] == 7085.0

    # 4. Atualizar os saldos para um novo valor
    update_bal_res = await client.put(
        f"/api/v1/bank-accounts/{acc_id}/balances",
        json={
            "balances": [
                {"owner_id": rafael["id"], "balance": 15000.0},
                {"owner_id": mae["id"], "balance": 5000.0},
            ]
        },
    )
    assert update_bal_res.status_code == 200
    updated_bal = update_bal_res.json()
    # Tot = 20000.0
    # Rendimento mensal = 20000 * 0.85% = 170.0
    # Total outros = 5000.0
    # Rafael próprio = 15000.0
    # Net = 15170.0
    assert updated_bal["total_balance"] == 20000.0
    assert updated_bal["others_balance"] == 5000.0
    assert updated_bal["owner_balance"] == 15000.0
    assert updated_bal["monthly_yield"] == 170.0
    assert updated_bal["net_with_yield"] == 15170.0

    # 5. Obter resumo consolidado global de contas bancárias
    summary_res = await client.get("/api/v1/bank-accounts/summary")
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["grand_total_balance"] >= 20000.0
    assert summary["grand_total_monthly_yield"] >= 170.0
    assert summary["grand_total_others"] >= 5000.0
    assert summary["grand_total_owner"] >= 15000.0

    # 6. Excluir a conta bancária de teste
    del_res = await client.delete(f"/api/v1/bank-accounts/{acc_id}")
    assert del_res.status_code == 200
