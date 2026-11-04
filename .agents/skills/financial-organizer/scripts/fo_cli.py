#!/usr/bin/env python3
"""
Financial Organizer (FO) - CLI & Automation Tool
Utilitário CLI para gerenciamento, inspeção e automação do Financial Organizer.
Permite consultar fechamento de fatura, rateio familiar (Rafael, Mãe, Irmã),
adicionar despesas manuais, alterar status de quitação e extrair faturas em PDF via Gemini.
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime, timezone

# Força encoding UTF-8 no console Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Resolve diretório base do projeto
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR) if os.path.basename(SCRIPT_DIR) == "scripts" else SCRIPT_DIR
BACKEND_DIR = os.path.join(PROJECT_ROOT, "backend")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.card import Card
from app.models.category import Category
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.services.dashboard_service import get_dashboard_summary


async def cmd_status():
    """Exibe status geral do banco de dados e ambiente."""
    print("=" * 70)
    print("🏦 FINANCIAL ORGANIZER - STATUS DO SISTEMA")
    print("=" * 70)
    print(f"Diretório Raiz: {PROJECT_ROOT}")
    db_path = os.path.join(PROJECT_ROOT, "financial.db")
    print(f"Banco SQLite:   {db_path} ({'Existe' if os.path.exists(db_path) else 'Não encontrado'})")

    async with AsyncSessionLocal() as db:
        owners_count = (await db.execute(select(Owner))).scalars().all()
        cards_count = (await db.execute(select(Card))).scalars().all()
        cats_count = (await db.execute(select(Category))).scalars().all()
        tx_count = (await db.execute(select(Transaction))).scalars().all()

        print(f"\n📊 Registros no Banco de Dados:")
        print(f"  • Proprietários cadastrados: {len(owners_count)} ({', '.join(o.name for o in owners_count)})")
        print(f"  • Cartões cadastrados:       {len(cards_count)} ({', '.join(c.card_name for c in cards_count)})")
        print(f"  • Categorias ativas:         {len(cats_count)}")
        print(f"  • Total de transações:       {len(tx_count)}")
    print("=" * 70)


async def cmd_summary(month: str, card_id: int = None):
    """Exibe o rateio familiar consolidado e despesas do mês."""
    if not month:
        now = datetime.now(timezone.utc)
        month = f"{now.year}-{now.month:02d}"

    async with AsyncSessionLocal() as db:
        summary = await get_dashboard_summary(db=db, month=month, card_id=card_id)

    print("=" * 75)
    print(f"💳 RESUMO DA FATURA & RATEIO FAMILIAR — MÊS {month}")
    print("=" * 75)
    print(f"  Total da Fatura:       R$ {summary.total_amount:>10.2f}")
    print(f"  Total Quitado:         R$ {summary.total_paid:>10.2f}")
    print(f"  Total Pendente:        R$ {summary.total_pending:>10.2f}")
    print("-" * 75)
    print(f"  {'RESPONSÁVEL':<15} {'TOTAL (R$)':>12} {'PAGO (R$)':>12} {'PENDENTE (R$)':>14} {'STATUS':<15}")
    print("-" * 75)
    for sp in summary.owners_summary:
        st_icon = "🟢" if sp.status == "Pago" else "🟡" if sp.status == "Parcial" else "🔴" if sp.status == "Pendente" else "⚪"
        print(f"  {sp.owner_name:<15} {sp.total_amount:>12.2f} {sp.paid_amount:>12.2f} {sp.pending_amount:>14.2f} {st_icon} {sp.status:<12}")
    print("-" * 75)

    if summary.category_summary:
        print("\n🏷️  GASTOS POR CATEGORIA:")
        for cat in summary.category_summary:
            print(f"  • {cat.category_name:<18}: R$ {cat.total_amount:>8.2f} ({cat.percentage:>5.1f}%)")
    print("=" * 75)


async def cmd_list_transactions(month: str = None, pending_only: bool = False):
    """Lista transações do mês com filtros."""
    async with AsyncSessionLocal() as db:
        stmt = select(Transaction).order_by(Transaction.dt_lcto.desc())
        res = await db.execute(stmt)
        txs = res.scalars().all()

        owners = {o.id: o.name for o in (await db.execute(select(Owner))).scalars().all()}
        cards = {c.id: c.card_name for c in (await db.execute(select(Card))).scalars().all()}

    if month:
        txs = [t for t in txs if t.dt_lcto.strftime("%Y-%m") == month]
    if pending_only:
        txs = [t for t in txs if not t.is_paid]

    print("=" * 90)
    print(f"📋 TRANSAÇÕES ({len(txs)} encontradas{' - Apenas Pendentes' if pending_only else ''})")
    print("=" * 90)
    print(f"  {'ID':<5} {'DATA':<11} {'RESPONSÁVEL':<12} {'CARTÃO':<12} {'VALOR (R$)':>10} {'PARC':<6} {'STATUS':<10} {'DESCRIÇÃO'}")
    print("-" * 90)
    for t in txs:
        owner_name = owners.get(t.owner_id, "Desconhecido")
        card_name = cards.get(t.card_id, "S/ Cartão")
        dt_str = t.dt_lcto.strftime("%d/%m/%Y")
        parc_str = f"{t.cur_parcs}/{t.total_parcs}"
        status_str = "🟢 Pago" if t.is_paid else "🔴 Pendente"
        print(f"  {t.id:<5} {dt_str:<11} {owner_name:<12} {card_name:<12} {t.value:>10.2f} {parc_str:<6} {status_str:<10} {t.description[:25]}")
    print("=" * 90)


async def cmd_add_transaction(desc: str, value: float, owner_name: str, cat_name: str, card_name: str = None, parcs: str = "1/1", comment: str = None):
    """Adiciona uma transação manualmente."""
    cur_p, tot_p = 1, 1
    if "/" in parcs:
        p_parts = parcs.split("/")
        cur_p, tot_p = int(p_parts[0]), int(p_parts[1])

    async with AsyncSessionLocal() as db:
        # Busca dono
        res_owner = await db.execute(select(Owner).where(Owner.name.ilike(f"%{owner_name}%")))
        owner = res_owner.scalars().first()
        if not owner:
            print(f"❌ Erro: Proprietário com nome '{owner_name}' não encontrado.")
            return

        # Busca categoria
        res_cat = await db.execute(select(Category).where(Category.description.ilike(f"%{cat_name}%")))
        cat = res_cat.scalars().first()
        if not cat:
            print(f"❌ Erro: Categoria '{cat_name}' não encontrada.")
            return

        # Busca cartão
        card_id = None
        if card_name:
            res_card = await db.execute(select(Card).where(Card.card_name.ilike(f"%{card_name}%")))
            card = res_card.scalars().first()
            if card:
                card_id = card.id
        else:
            first_card = (await db.execute(select(Card))).scalars().first()
            if first_card:
                card_id = first_card.id

        now = datetime.now(timezone.utc)
        tx = Transaction(
            dt_lcto=now,
            description=desc,
            value=value,
            owner_id=owner.id,
            card_id=card_id,
            type_id=cat.id,
            cur_parcs=cur_p,
            total_parcs=tot_p,
            is_paid=False,
            is_forecast=False,
            comment=comment or "Lançamento manual via CLI",
        )
        db.add(tx)
        await db.commit()
        await db.refresh(tx)
        print(f"✅ Transação #{tx.id} cadastrada com sucesso: {desc} (R$ {value:.2f}) para {owner.name}!")


async def cmd_toggle_paid(tx_id: int):
    """Alterna o status de quitação de uma transação."""
    async with AsyncSessionLocal() as db:
        tx = await db.get(Transaction, tx_id)
        if not tx:
            print(f"❌ Transação ID #{tx_id} não encontrada.")
            return
        tx.is_paid = not tx.is_paid
        await db.commit()
        await db.refresh(tx)
        status_text = "🟢 PAGO" if tx.is_paid else "🔴 PENDENTE"
        print(f"✅ Transação #{tx.id} ('{tx.description}') atualizada para {status_text}.")


async def cmd_extract_invoice(pdf_path: str, card_id: int = None, auto_confirm: bool = False):
    """Extrai itens de um PDF de fatura usando a API do Gemini."""
    if not os.path.exists(pdf_path):
        print(f"❌ Arquivo não encontrado: {pdf_path}")
        return

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    print(f"📄 Lendo arquivo '{pdf_path}' ({len(pdf_bytes)} bytes)...")
    print("🤖 Enviando para o Google Gemini API (gemini-2.5-flash)...")

    from app.services.gemini_service import extract_invoice_from_pdf, confirm_invoice_transactions
    from app.schemas.invoice import InvoiceConfirmRequest, InvoiceConfirmItem

    async with AsyncSessionLocal() as db:
        extracted = await extract_invoice_from_pdf(db=db, pdf_bytes=pdf_bytes, card_id=card_id)

        print("\n" + "=" * 80)
        print("📑 RESULTADO DA EXTRAÇÃO DA FATURA")
        print("=" * 80)
        print(f"Banco / Emissor:  {extracted.bank_or_issuer or 'Não detectado'}")
        print(f"Mês de Referência: {extracted.invoice_month_year or 'Não detectado'}")
        print(f"Vencimento:       {extracted.due_date or 'Não detectado'}")
        print(f"Total da Fatura:  R$ {extracted.total_invoice_amount:>8.2f}")
        print(f"Total de Itens:   {len(extracted.items)}")
        print("-" * 80)
        print(f"  {'#':<3} {'DATA':<11} {'VALOR (R$)':>10} {'PARC':<6} {'RESPONSÁVEL':<12} {'CATEGORIA':<15} {'DESCRIÇÃO'}")
        print("-" * 80)

        for i, item in enumerate(extracted.items, 1):
            parc = f"{item.current_installment}/{item.total_installments}"
            owner = item.suggested_owner or "A definir"
            cat = item.suggested_category or "Outros"
            print(f"  {i:<3} {item.purchase_date:<11} {item.amount:>10.2f} {parc:<6} {owner:<12} {cat:<15} {item.description[:22]}")
        print("=" * 80)

        if auto_confirm:
            print("\n💾 Confirmando e salvando transações no SQLite...")
            confirm_items = []
            for it in extracted.items:
                confirm_items.append(
                    InvoiceConfirmItem(
                        dt_lcto=datetime.strptime(it.purchase_date, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                        description=it.description,
                        value=it.amount,
                        owner_id=it.owner_id or 1,
                        type_id=it.category_id or 1,
                        cur_parcs=it.current_installment,
                        total_parcs=it.total_installments,
                        is_paid=False,
                        comment=f"Importado de fatura PDF ({extracted.bank_or_issuer})",
                    )
                )
            req = InvoiceConfirmRequest(card_id=extracted.card_id or card_id, items=confirm_items)
            res = await confirm_invoice_transactions(db=db, request=req)
            print(f"✅ {res.confirmed_count} transações confirmadas e salvas com sucesso no banco!")


def main():
    parser = argparse.ArgumentParser(
        description="Financial Organizer CLI - Ferramenta de gestão financeira familiar e extração de faturas."
    )
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponíveis")

    # status
    subparsers.add_parser("status", help="Exibe status geral do banco de dados e ambiente.")

    # summary
    p_summary = subparsers.add_parser("summary", help="Exibe resumo mensal e rateio familiar.")
    p_summary.add_argument("--month", "-m", help="Mês de referência (formato YYYY-MM, ex: 2026-11)")
    p_summary.add_argument("--card-id", "-c", type=int, help="ID do cartão para filtrar")

    # list
    p_list = subparsers.add_parser("list", help="Lista transações cadastradas.")
    p_list.add_argument("--month", "-m", help="Filtrar por mês (YYYY-MM)")
    p_list.add_argument("--pending-only", "-p", action="store_true", help="Filtrar apenas dívidas pendentes")

    # add
    p_add = subparsers.add_parser("add", help="Adiciona uma transação manual.")
    p_add.add_argument("--desc", "-d", required=True, help="Descrição da compra")
    p_add.add_argument("--value", "-v", type=float, required=True, help="Valor da compra (R$)")
    p_add.add_argument("--owner", "-o", required=True, help="Nome do responsável (Rafael, Mãe, Irmã)")
    p_add.add_argument("--cat", required=True, help="Nome da categoria (Mercado, Lazer, etc.)")
    p_add.add_argument("--card", help="Nome do cartão (opcional, padrão: primeiro cartão)")
    p_add.add_argument("--parcs", default="1/1", help="Parcelas no formato 1/1 ou 2/10")
    p_add.add_argument("--comment", help="Comentário ou observação opcional")

    # toggle-paid
    p_toggle = subparsers.add_parser("toggle-paid", help="Alterna quitação da dívida de uma transação.")
    p_toggle.add_argument("id", type=int, help="ID da transação")

    # extract
    p_extract = subparsers.add_parser("extract", help="Extrai compras de fatura em PDF via Gemini.")
    p_extract.add_argument("pdf", help="Caminho do arquivo PDF da fatura")
    p_extract.add_argument("--card-id", "-c", type=int, help="ID do cartão correspondente")
    p_extract.add_argument("--confirm", action="store_true", help="Salva automaticamente os itens no banco após extrair")

    # validate
    subparsers.add_parser("validate", help="Executa auditoria completa de 100%% das rotas da API.")

    args = parser.parse_args()

    if not args.command or args.command == "status":
        asyncio.run(cmd_status())
    elif args.command == "summary":
        asyncio.run(cmd_summary(month=args.month, card_id=args.card_id))
    elif args.command == "list":
        asyncio.run(cmd_list_transactions(month=args.month, pending_only=args.pending_only))
    elif args.command == "add":
        asyncio.run(cmd_add_transaction(
            desc=args.desc,
            value=args.value,
            owner_name=args.owner,
            cat_name=args.cat,
            card_name=args.card,
            parcs=args.parcs,
            comment=args.comment,
        ))
    elif args.command == "toggle-paid":
        asyncio.run(cmd_toggle_paid(args.id))
    elif args.command == "extract":
        asyncio.run(cmd_extract_invoice(pdf_path=args.pdf, card_id=args.card_id, auto_confirm=args.confirm))
    elif args.command == "validate":
        test_script = os.path.join(BACKEND_DIR, "tests", "validate_all_routes.py")
        import subprocess
        python_bin = sys.executable
        subprocess.run([python_bin, test_script])


if __name__ == "__main__":
    main()
