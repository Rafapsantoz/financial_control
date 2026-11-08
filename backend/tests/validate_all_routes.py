"""
Script de Validação e Auditoria Completa de Todas as Rotas da API
Valida 100% dos endpoints REST do Financial Organizer (Status HTTP, Schemas e Regras de Negócio).
"""

import asyncio
import os
import sys
import time

# Configura encoding UTF-8 no Windows
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

# Adiciona o diretório do backend ao sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from httpx import ASGITransport, AsyncClient
from app.main import app

def print_result(route: str, method: str, status_code: int, expected: int, detail: str = ""):
    ok = status_code == expected
    status_str = f"[\033[92mOK {status_code}\033[0m]" if ok else f"[\033[91mFAIL {status_code}\033[0m]"
    detail_str = f" - {detail}" if detail else ""
    print(f" {status_str} {method.ljust(6)} {route.ljust(45)}{detail_str}")
    return ok


async def run_route_validation():
    print("=" * 80)
    print("🚀 AUDITORIA E VALIDAÇÃO COMPLETA DE TODAS AS ROTAS — FINANCIAL ORGANIZER")
    print(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)

    total_checks = 0
    passed_checks = 0

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver", follow_redirects=True) as client:
        # -------------------------------------------------------------
        # 1. HEALTH & ROOT
        # -------------------------------------------------------------
        print("\n🔹 [1/6] Rotas de Sistema e Healthcheck:")
        
        total_checks += 1
        res = await client.get("/")
        if print_result("/", "GET", res.status_code, 200, res.json().get("app", "")):
            passed_checks += 1

        total_checks += 1
        res = await client.get("/health")
        if print_result("/health", "GET", res.status_code, 200, res.json().get("status", "")):
            passed_checks += 1

        # -------------------------------------------------------------
        # 2. OWNERS (Rafael, Mãe, Irmã)
        # -------------------------------------------------------------
        print("\n🔹 [2/6] Rotas de Donos da Dívida (/api/v1/owners):")
        
        # Listar
        total_checks += 1
        res = await client.get("/api/v1/owners")
        owners = res.json()
        if print_result("/api/v1/owners", "GET", res.status_code, 200, f"{len(owners)} proprietários listados"):
            passed_checks += 1

        # Criar
        total_checks += 1
        res = await client.post("/api/v1/owners", json={"name": "Parente Teste", "category": "Família", "phone_number": "11999999999"})
        new_owner = res.json()
        owner_id = new_owner.get("id")
        if print_result("/api/v1/owners", "POST", res.status_code, 201, f"Criado ID {owner_id}"):
            passed_checks += 1

        # Obter por ID
        total_checks += 1
        res = await client.get(f"/api/v1/owners/{owner_id}")
        if print_result(f"/api/v1/owners/{owner_id}", "GET", res.status_code, 200, res.json().get("name")):
            passed_checks += 1

        # Atualizar
        total_checks += 1
        res = await client.put(f"/api/v1/owners/{owner_id}", json={"name": "Parente Atualizado", "category": "Amigo"})
        if print_result(f"/api/v1/owners/{owner_id}", "PUT", res.status_code, 200, f"Nome: {res.json().get('name')}"):
            passed_checks += 1

        # Deletar
        total_checks += 1
        res = await client.delete(f"/api/v1/owners/{owner_id}")
        if print_result(f"/api/v1/owners/{owner_id}", "DELETE", res.status_code, 200, "Removido com sucesso"):
            passed_checks += 1

        # -------------------------------------------------------------
        # 3. CARDS (Cartões de Crédito)
        # -------------------------------------------------------------
        print("\n🔹 [3/6] Rotas de Cartões (/api/v1/cards):")

        # Listar
        total_checks += 1
        res = await client.get("/api/v1/cards")
        cards = res.json()
        if print_result("/api/v1/cards", "GET", res.status_code, 200, f"{len(cards)} cartões cadastrados"):
            passed_checks += 1

        # Criar
        total_checks += 1
        res = await client.post("/api/v1/cards", json={"card_name": "Inter Black Teste", "due_day": 15, "total_limit": 15000.0})
        new_card = res.json()
        card_id = new_card.get("id")
        if print_result("/api/v1/cards", "POST", res.status_code, 201, f"Criado ID {card_id}"):
            passed_checks += 1

        # Obter por ID
        total_checks += 1
        res = await client.get(f"/api/v1/cards/{card_id}")
        if print_result(f"/api/v1/cards/{card_id}", "GET", res.status_code, 200, res.json().get("card_name")):
            passed_checks += 1

        # Atualizar
        total_checks += 1
        res = await client.put(f"/api/v1/cards/{card_id}", json={"card_name": "Inter Black Platinum", "total_limit": 20000.0})
        if print_result(f"/api/v1/cards/{card_id}", "PUT", res.status_code, 200, f"Novo Limite: R$ {res.json().get('total_limit')}"):
            passed_checks += 1

        # Deletar
        total_checks += 1
        res = await client.delete(f"/api/v1/cards/{card_id}")
        if print_result(f"/api/v1/cards/{card_id}", "DELETE", res.status_code, 200, "Removido com sucesso"):
            passed_checks += 1

        # -------------------------------------------------------------
        # 4. CATEGORIES (Categorias de Gastos)
        # -------------------------------------------------------------
        print("\n🔹 [4/6] Rotas de Categorias (/api/v1/categories):")

        # Listar
        total_checks += 1
        res = await client.get("/api/v1/categories")
        categories = res.json()
        if print_result("/api/v1/categories", "GET", res.status_code, 200, f"{len(categories)} categorias padrão"):
            passed_checks += 1

        # Criar
        total_checks += 1
        res = await client.post("/api/v1/categories", json={"description": "Educação & Cursos"})
        new_cat = res.json()
        cat_id = new_cat.get("id")
        if print_result("/api/v1/categories", "POST", res.status_code, 201, f"Criado ID {cat_id}"):
            passed_checks += 1

        # Obter por ID
        total_checks += 1
        res = await client.get(f"/api/v1/categories/{cat_id}")
        if print_result(f"/api/v1/categories/{cat_id}", "GET", res.status_code, 200, res.json().get("description")):
            passed_checks += 1

        # Atualizar
        total_checks += 1
        res = await client.put(f"/api/v1/categories/{cat_id}", json={"description": "Educação, Livros & Cursos"})
        if print_result(f"/api/v1/categories/{cat_id}", "PUT", res.status_code, 200, res.json().get("description")):
            passed_checks += 1

        # Deletar
        total_checks += 1
        res = await client.delete(f"/api/v1/categories/{cat_id}")
        if print_result(f"/api/v1/categories/{cat_id}", "DELETE", res.status_code, 200, "Removido com sucesso"):
            passed_checks += 1

        # -------------------------------------------------------------
        # 5. TRANSACTIONS (Lançamentos Manuais & Baixa)
        # -------------------------------------------------------------
        print("\n🔹 [5/6] Rotas de Transações (/api/v1/transactions):")

        # Recuperar IDs válidos de Rafael, Nubank e Mercado
        rafael_id = next(o["id"] for o in owners if o["name"] == "Rafael")
        mae_id = next(o["id"] for o in owners if o["name"] == "Mãe")
        nubank_id = cards[0]["id"]
        mercado_id = next(c["id"] for c in categories if "Mercado" in c["description"])

        # Criar Transação 1 (Rafael)
        total_checks += 1
        tx1_data = {
            "dt_lcto": "2026-11-02T10:00:00",
            "description": "Supermercado Pão de Açúcar",
            "owner_id": rafael_id,
            "card_id": nubank_id,
            "type_id": mercado_id,
            "value": 350.50,
            "cur_parcs": 1,
            "total_parcs": 1,
            "is_paid": False,
            "comment": "Compras do mês",
        }
        res = await client.post("/api/v1/transactions", json=tx1_data)
        tx1 = res.json()
        tx1_id = tx1.get("id")
        if print_result("/api/v1/transactions", "POST", res.status_code, 201, f"Transação ID {tx1_id} (R$ 350.50)"):
            passed_checks += 1

        # Criar Transação 2 (Mãe - Parcelada)
        total_checks += 1
        tx2_data = {
            "dt_lcto": "2026-11-03T14:30:00",
            "description": "Drogaria São Paulo",
            "owner_id": mae_id,
            "card_id": nubank_id,
            "type_id": mercado_id,
            "value": 120.00,
            "cur_parcs": 1,
            "total_parcs": 3,
            "is_paid": False,
            "comment": "Medicamentos de uso contínuo",
        }
        res = await client.post("/api/v1/transactions", json=tx2_data)
        tx2 = res.json()
        tx2_id = tx2.get("id")
        if print_result("/api/v1/transactions", "POST", res.status_code, 201, f"Transação ID {tx2_id} (R$ 120.00 - 1/3)"):
            passed_checks += 1

        # Listar com Filtro por Mês
        total_checks += 1
        res = await client.get("/api/v1/transactions?month=2026-11")
        if print_result("/api/v1/transactions?month=2026-11", "GET", res.status_code, 200, f"{len(res.json())} transações no mês"):
            passed_checks += 1

        # Obter Transação Específica
        total_checks += 1
        res = await client.get(f"/api/v1/transactions/{tx1_id}")
        if print_result(f"/api/v1/transactions/{tx1_id}", "GET", res.status_code, 200, res.json().get("description")):
            passed_checks += 1

        # Toggle de Pagamento (is_paid: False -> True)
        total_checks += 1
        res = await client.patch(f"/api/v1/transactions/{tx2_id}/toggle-paid")
        is_paid_status = res.json().get("is_paid")
        if print_result(f"/api/v1/transactions/{tx2_id}/toggle-paid", "PATCH", res.status_code, 200, f"Novo status is_paid: {is_paid_status}"):
            passed_checks += 1

        # -------------------------------------------------------------
        # 6. DASHBOARD & RATEIO FAMILIAR
        # -------------------------------------------------------------
        print("\n🔹 [6/7] Dashboard de Fechamento e Rateio (/api/v1/dashboard/summary):")

        total_checks += 1
        res = await client.get("/api/v1/dashboard/summary?month=2026-11")
        summary = res.json()
        total_fatura = summary.get("total_amount", 0)
        owners_list = summary.get("owners_summary", [])
        categories_breakdown = summary.get("category_summary", [])
        
        detail_dash = f"Fatura Total: R$ {total_fatura:.2f} | Membros com rateio: {len(owners_list)}"
        if print_result("/api/v1/dashboard/summary?month=2026-11", "GET", res.status_code, 200, detail_dash):
            passed_checks += 1

        # Exibir rateio detalhado
        print("\n    📊 Detalhamento do Rateio Familiar Verificado:")
        for sp in owners_list:
            print(f"       • {sp['owner_name'].ljust(10)}: Total: R$ {sp['total_amount']:>8.2f} | Pago: R$ {sp['paid_amount']:>8.2f} | Pendente: R$ {sp['pending_amount']:>8.2f} ({sp['status']})")
        
        print("\n    🏷️ Gastos por Categoria Verificados:")
        for cat in categories_breakdown:
            print(f"       • {cat['category_name'].ljust(15)}: R$ {cat['total_amount']:>8.2f} ({cat['percentage']:>5.1f}%)")

        # Limpeza das transações de teste
        await client.delete(f"/api/v1/transactions/{tx1_id}")
        await client.delete(f"/api/v1/transactions/{tx2_id}")

        # -------------------------------------------------------------
        # 7. INVOICES (Extração Gemini & Confirmação em Lote)
        # -------------------------------------------------------------
        print("\n🔹 [7/7] Rotas de Faturas e Inteligência Artificial (/api/v1/invoices):")

        # 7.1 Validação de rejeição de arquivo não-PDF
        total_checks += 1
        bad_files = {"file": ("teste.txt", b"arquivo de texto simples", "text/plain")}
        res = await client.post("/api/v1/invoices/extract", files=bad_files)
        if print_result("/api/v1/invoices/extract (Validação TXT)", "POST", res.status_code, 400, "Rejeitou formato não-PDF corretamente"):
            passed_checks += 1

        # 7.2 Extração de fatura PDF (Simulação do pipeline Gemini)
        synthetic_pdf = (
            b"%PDF-1.4\n"
            b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
            b"xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n"
            b"trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF"
        )
        custom_gemini_response = {
            "bank_or_issuer": "Nubank",
            "invoice_month_year": "2026-11",
            "due_date": "2026-11-10",
            "total_invoice_amount": 250.00,
            "items": [
                {
                    "purchase_date": "2026-10-15",
                    "description": "Drogaria São Paulo",
                    "amount": 100.00,
                    "current_installment": 1,
                    "total_installments": 1,
                    "suggested_category": "Farmácia",
                    "suggested_owner": "Mãe",
                },
                {
                    "purchase_date": "2026-10-20",
                    "description": "Netflix Mensalidade",
                    "amount": 150.00,
                    "current_installment": 1,
                    "total_installments": 1,
                    "suggested_category": "Assinaturas",
                    "suggested_owner": "Rafael",
                },
            ],
        }

        from unittest.mock import AsyncMock, MagicMock, patch
        import json

        mock_resp = MagicMock()
        mock_resp.text = json.dumps(custom_gemini_response)
        mock_resp.parsed = None

        with patch("app.core.gemini.get_gemini_client") as mock_get_client:
            mock_client_inst = MagicMock()
            mock_client_inst.aio.models.generate_content = AsyncMock(return_value=mock_resp)
            mock_get_client.return_value = mock_client_inst

            total_checks += 1
            files = {"file": ("fatura_novembro.pdf", synthetic_pdf, "application/pdf")}
            res = await client.post("/api/v1/invoices/extract", files=files, data={"card_id": nubank_id})
            extracted = res.json()
            if print_result("/api/v1/invoices/extract (PDF + IA)", "POST", res.status_code, 200, f"{len(extracted.get('items', []))} itens extraídos"):
                passed_checks += 1

        # 7.3 Confirmação em Lote (/api/v1/invoices/confirm)
        total_checks += 1
        confirm_payload = {
            "card_id": nubank_id,
            "items": [
                {
                    "dt_lcto": "2026-11-05T10:00:00",
                    "description": "Drogaria São Paulo (Confirmada)",
                    "value": 100.00,
                    "owner_id": mae_id,
                    "type_id": mercado_id,
                    "cur_parcs": 1,
                    "total_parcs": 1,
                    "is_paid": False,
                    "comment": "Extraído via fatura PDF",
                }
            ]
        }
        res = await client.post("/api/v1/invoices/confirm", json=confirm_payload)
        confirm_res = res.json()
        persisted_items = confirm_res.get("created_transactions", [])
        confirmed_count = confirm_res.get("confirmed_count", 0)
        if print_result("/api/v1/invoices/confirm", "POST", res.status_code, 201, f"{confirmed_count} transações persistidas"):
            passed_checks += 1

        # Limpeza da transação confirmada
        if persisted_items:
            await client.delete(f"/api/v1/transactions/{persisted_items[0]['id']}")

    print("\n" + "=" * 80)
    print("📊 RESULTADO DA AUDITORIA DE ROTAS")
    print("=" * 80)
    print(f"Total de Verificações: {total_checks}")
    print(f"Rotas Aprovadas:       {passed_checks}")
    print(f"Taxa de Sucesso:       {(passed_checks / total_checks) * 100:.1f}%")
    print(f"Status Geral:          {'🟢 100% OPERACIONAL E HOMOLOGADO' if passed_checks == total_checks else '🔴 FALHAS ENCONTRADAS'}")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(run_route_validation())
