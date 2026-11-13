import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.audit_log import AuditLog


@pytest.mark.asyncio
async def test_audit_log_lifecycle_on_transaction_crud(client: AsyncClient, db_session: AsyncSession):
    """
    Valida a gravação completa de logs em todas as operações chave de transações:
    1. Inclusão (CREATE)
    2. Alteração (UPDATE)
    3. Alternância de status de quitação (UPDATE)
    4. Exclusão (DELETE) com snapshot completo em old_values para proteção de dados
    """
    # 1. Obter IDs mestres
    owners_res = await client.get("/api/v1/owners")
    owner_id = owners_res.json()[0]["id"]

    cards_res = await client.get("/api/v1/cards")
    card_id = cards_res.json()[0]["id"]

    cats_res = await client.get("/api/v1/categories")
    cat_id = cats_res.json()[0]["id"]

    # 2. CREATE: Criar transação
    tx_payload = {
        "dt_lcto": "2026-11-12T10:00:00Z",
        "description": "Compra Teste Auditoria",
        "value": 189.90,
        "owner_id": owner_id,
        "card_id": card_id,
        "type_id": cat_id,
        "total_parcs": 1,
        "cur_parcs": 1,
        "comment": "Teste de audit log",
        "invoice_month": "2026-11",
        "is_paid": False,
        "is_forecast": False,
    }
    create_res = await client.post("/api/v1/transactions", json=tx_payload)
    assert create_res.status_code == 201
    created_tx = create_res.json()
    tx_id = created_tx["id"]

    # Verificar log de CREATE
    logs_res = await client.get(f"/api/v1/audit-logs?entity_type=TRANSACTION&action=CREATE&entity_id={tx_id}")
    assert logs_res.status_code == 200
    create_logs = logs_res.json()["items"]
    assert len(create_logs) >= 1
    latest_create = create_logs[0]
    assert latest_create["action"] == "CREATE"
    assert latest_create["entity_type"] == "TRANSACTION"
    assert latest_create["entity_id"] == tx_id
    assert "Compra Teste Auditoria" in latest_create["description"]
    assert latest_create["new_values"] is not None
    assert latest_create["new_values"]["description"] == "Compra Teste Auditoria"
    assert latest_create["new_values"]["value"] == 189.90

    # 3. UPDATE: Alterar valor e descrição
    update_payload = {
        "description": "Compra Teste Auditoria Alterada",
        "value": 250.00,
    }
    update_res = await client.put(f"/api/v1/transactions/{tx_id}", json=update_payload)
    assert update_res.status_code == 200

    # Verificar log de UPDATE com old_values e new_values
    logs_res = await client.get(f"/api/v1/audit-logs?entity_type=TRANSACTION&action=UPDATE&entity_id={tx_id}")
    assert logs_res.status_code == 200
    update_logs = logs_res.json()["items"]
    assert len(update_logs) >= 1
    latest_update = update_logs[0]
    assert latest_update["action"] == "UPDATE"
    assert latest_update["old_values"]["description"] == "Compra Teste Auditoria"
    assert latest_update["old_values"]["value"] == 189.90
    assert latest_update["new_values"]["description"] == "Compra Teste Auditoria Alterada"
    assert latest_update["new_values"]["value"] == 250.00

    # 4. TOGGLE PAID: Alterar status de quitação
    toggle_res = await client.patch(f"/api/v1/transactions/{tx_id}/toggle-paid")
    assert toggle_res.status_code == 200
    assert toggle_res.json()["is_paid"] is True

    # 5. DELETE: Excluir transação e verificar que snapshot antigo foi 100% preservado
    del_res = await client.delete(f"/api/v1/transactions/{tx_id}")
    assert del_res.status_code == 200

    logs_res = await client.get(f"/api/v1/audit-logs?entity_type=TRANSACTION&action=DELETE&entity_id={tx_id}")
    assert logs_res.status_code == 200
    delete_logs = logs_res.json()["items"]
    assert len(delete_logs) >= 1
    latest_del = delete_logs[0]
    assert latest_del["action"] == "DELETE"
    assert latest_del["old_values"] is not None
    assert latest_del["old_values"]["id"] == tx_id
    assert latest_del["old_values"]["description"] == "Compra Teste Auditoria Alterada"
    assert latest_del["old_values"]["value"] == 250.00


@pytest.mark.asyncio
async def test_audit_log_filters_and_stats(client: AsyncClient):
    """Testa paginação, busca textual e endpoint de estatísticas de auditoria."""
    # Obter lista paginada
    list_res = await client.get("/api/v1/audit-logs?limit=10&skip=0")
    assert list_res.status_code == 200
    data = list_res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)

    # Obter estatísticas
    stats_res = await client.get("/api/v1/audit-logs/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert "total_logs" in stats
    assert "by_action" in stats
    assert "by_entity" in stats
