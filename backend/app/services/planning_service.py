from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.card import Card
from app.models.category import Category
from app.models.goal import Goal
from app.models.owner import Owner
from app.models.transaction import Transaction
from app.schemas.planning import (
    FinancialPrinciple,
    FixedExpenseRow,
    LivingScenario,
    MacroProjectionResponse,
    MonthlyColumnSummary,
    RunwayMetric,
)

MONTH_NAMES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

# Dados base recorrentes mapeados diretamente da planilha do usuário
SPREADSHEET_FIXED_DEFAULTS = [
    {
        "name": "Casa 20 (Aluguel/Condomínio)",
        "category": "Moradia",
        "responsible": "Rafael",
        "values": {
            "05": 1129.44, "06": 1129.44, "07": 190.24, "08": 939.20,
            "09": 1174.20, "10": 1174.20, "11": 1174.20, "12": 1174.20
        }
    },
    {
        "name": "Custo Fixo Pessoal (Mercado, Carro, Cães)",
        "category": "Essencial",
        "responsible": "Rafael",
        "values": {
            "01": 1540.0, "02": 1540.0, "03": 1540.0, "04": 1540.0,
            "05": 1540.0, "06": 1540.0, "07": 1540.0, "08": 1540.0,
            "09": 1540.0, "10": 1540.0, "11": 1540.0, "12": 1540.0
        }
    },
    {
        "name": "Imposto MEI / DAS",
        "category": "Impostos",
        "responsible": "Rafael",
        "values": {
            "05": 821.60, "06": 150.00, "07": 380.00, "08": 184.00,
            "09": 276.80, "10": 620.00, "11": 620.00, "12": 620.00
        }
    },
    {
        "name": "Internet Fibra - dia 10",
        "category": "Telecom",
        "responsible": "Rafael",
        "values": {
            "05": 78.90, "06": 78.90, "07": 78.90, "08": 49.90,
            "09": 49.90, "10": 150.00, "11": 150.00, "12": 49.90
        }
    },
    {
        "name": "Claro Celular",
        "category": "Telecom",
        "responsible": "Rafael",
        "values": {
            "05": 44.90, "06": 44.90, "08": 45.00, "09": 45.00,
            "11": 45.00, "12": 45.00
        }
    },
    {
        "name": "Documento Carro - 23",
        "category": "Transporte",
        "responsible": "Rafael",
        "values": {
            "07": 87.25, "11": 174.08
        }
    },
    {
        "name": "Investimento na Carreira",
        "category": "Educação",
        "responsible": "Rafael",
        "values": {
            "07": 126.67, "09": 332.58, "10": 332.58, "11": 332.58, "12": 332.58
        }
    },
]

SPREADSHEET_CARD_DEFAULTS = [
    {
        "name": "PicPay",
        "category": "Cartão de Crédito",
        "responsible": "Rafael",
        "values": {
            "05": 2133.58, "06": 2159.84, "07": 1592.36, "08": 2381.97,
            "09": 2821.97, "10": 2430.45, "11": 88.22
        }
    },
    {
        "name": "Mercado Pago",
        "category": "Cartão de Crédito",
        "responsible": "Rafael",
        "values": {
            "05": 132.26, "06": 2601.39, "07": 2521.96
        }
    },
    {
        "name": "Nubank Empresa",
        "category": "Cartão de Crédito",
        "responsible": "Rafael",
        "values": {
            "05": 1814.43, "06": 1837.46, "07": 2095.31, "08": 1244.80,
            "09": 1006.91, "10": 825.67, "11": 200.83
        }
    },
]

SPREADSHEET_PRINCIPLES: List[Dict[str, any]] = [
    {
        "step": 1,
        "title": "Entradas, Saídas e Perfil de Risco",
        "description": "Mapeie detalhadamente seus 3 maiores custos fixos e monitore mensalmente sua queima de caixa.",
        "category": "Orçamento"
    },
    {
        "step": 2,
        "title": "Inventário Rigoroso de Dívidas",
        "description": "Listar todas as dívidas, credores, parcelas restantes, taxas de juros e valor exato da parcela.",
        "category": "Dívidas"
    },
    {
        "step": 3,
        "title": "Classificação em 3 Níveis",
        "description": "Separar despesas em: Essencial (moradia, comida, saúde, cães), Importante (transporte, carreira) e Supérfluo (delivery, assinaturas).",
        "category": "Orçamento"
    },
    {
        "step": 4,
        "title": "Corte de Supérfluos Recorrentes",
        "description": "Cancelar ativamente pelo menos 2 gastos supérfluos recorrentes a cada trimestre.",
        "category": "Hábitos"
    },
    {
        "step": 5,
        "title": "Renegociação Proativa",
        "description": "Renegociar taxas de serviços, internet, planos e dívidas sempre que as faturas subirem.",
        "category": "Dívidas"
    },
    {
        "step": 6,
        "title": "Orçamento Base Zero (50-30-20)",
        "description": "Prever a renda do próximo mês alocando: 50% necessidades, 30% desejos e 20% poupança/investimentos.",
        "category": "Orçamento"
    },
    {
        "step": 7,
        "title": "Automação Financeira",
        "description": "Colocar no débito automático contas essenciais invariáveis (água, luz, internet) para nunca pagar juros de atraso.",
        "category": "Hábitos"
    },
    {
        "step": 8,
        "title": "Reserva de Emergência (Runway)",
        "description": "Garantir no mínimo de 5 a 6 meses de custo fixo guardados em liquidez diária.",
        "category": "Metas"
    },
    {
        "step": 9,
        "title": "Detox do Consumo",
        "description": "Praticar dias programados com zero gastos não-essenciais.",
        "category": "Hábitos"
    },
    {
        "step": 10,
        "title": "Auditoria de Renda Extra",
        "description": "Identificar ao menos 3 oportunidades no mês para monetização rápida (freelas, vendas, esteiras).",
        "category": "Metas"
    },
    {
        "step": 11,
        "title": "Regra das 72 Horas",
        "description": "Qualquer compra de desejo com valor superior a 2% da renda líquida deve aguardar 72 horas para reflexão.",
        "category": "Hábitos"
    },
    {
        "step": 12,
        "title": "Educação Financeira Contínua",
        "description": "Estudar juros compostos, inflação real e custo de oportunidade.",
        "category": "Metas"
    },
    {
        "step": 13,
        "title": "Alinhamento e Conversas Transparentes",
        "description": "Manter alinhamento financeiro transparente e sem tabus com familiares que dividem o teto ou faturas.",
        "category": "Hábitos"
    },
    {
        "step": 14,
        "title": "Revisão Geral e 3 Vitórias",
        "description": "Revisar os números mensalmente e celebrar 3 vitórias de economia ou disciplina financeira.",
        "category": "Hábitos"
    },
    {
        "step": 15,
        "title": "Plano de Sustentação Rítmico",
        "description": "Check semanal de 15 minutos no domingo e revisão de fechamento de 1 hora no dia 1º de cada mês.",
        "category": "Hábitos"
    },
]

SPREADSHEET_SCENARIOS = [
    {
        "id": "brodowski_padrao",
        "title": "Brodowski - Custo Otimizado",
        "city": "Brodowski",
        "has_home_office": True,
        "estimated_rent": 1200.0,
        "estimated_bills": 450.0,
        "total_monthly": 1650.0,
        "annual_impact": 19800.0,
        "notes": "Aluguel mais acessível com espaço tranquilo para Home Office."
    },
    {
        "id": "ribeirao_com_office",
        "title": "Ribeirão Preto - Com Home Office",
        "city": "Ribeirão Preto",
        "has_home_office": True,
        "estimated_rent": 1200.0,
        "estimated_bills": 550.0,
        "total_monthly": 1750.0,
        "annual_impact": 21000.0,
        "notes": "Opção negociada em Ribeirão Preto com espaço para escritório."
    },
    {
        "id": "ribeirao_sem_office",
        "title": "Ribeirão Preto - Bairro Central (Sem Office)",
        "city": "Ribeirão Preto",
        "has_home_office": False,
        "estimated_rent": 1650.0,
        "estimated_bills": 600.0,
        "total_monthly": 2250.0,
        "annual_impact": 27000.0,
        "notes": "Região central de Ribeirão Preto (faixa de R$ 1.500 a 1.800 de aluguel)."
    },
]


async def compute_macro_projection(
    db: AsyncSession,
    year: int = 2026,
    account_balance: float = 16638.40,
) -> MacroProjectionResponse:
    """
    Computa a matriz anual completa de 12 meses (Janeiro a Dezembro),
    combinando as contas fixas, faturas de cartão, compras parceladas e
    as transações persistidas no banco, calculando o Runway de sobrevivência.
    """
    # 1. Carregar transações do ano especificado
    start_dt = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    tx_stmt = select(Transaction).where(
        Transaction.dt_lcto >= start_dt,
        Transaction.dt_lcto < end_dt
    )
    tx_res = await db.execute(tx_stmt)
    transactions = tx_res.scalars().all()

    # 2. Carregar entidades de apoio
    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o.name for o in owners_res.scalars().all()}

    cats_res = await db.execute(select(Category))
    cats_map = {c.id: c.description for c in cats_res.scalars().all()}

    cards_res = await db.execute(select(Card))
    cards_map = {c.id: c.card_name for c in cards_res.scalars().all()}

    # 3. Montar linhas de custos fixos
    fixed_rows: List[FixedExpenseRow] = []
    for item in SPREADSHEET_FIXED_DEFAULTS:
        monthly_vals = {}
        for m in range(1, 13):
            m_key = f"{m:02d}"
            monthly_vals[m_key] = round(item["values"].get(m_key, 0.0), 2)
        total_yr = round(sum(monthly_vals.values()), 2)
        fixed_rows.append(FixedExpenseRow(
            name=item["name"],
            category=item["category"],
            responsible=item["responsible"],
            monthly_values=monthly_vals,
            total_year=total_yr
        ))

    # 4. Montar linhas de faturas de cartão
    card_rows: List[FixedExpenseRow] = []
    for c_item in SPREADSHEET_CARD_DEFAULTS:
        monthly_vals = {}
        for m in range(1, 13):
            m_key = f"{m:02d}"
            monthly_vals[m_key] = round(c_item["values"].get(m_key, 0.0), 2)
        total_yr = round(sum(monthly_vals.values()), 2)
        card_rows.append(FixedExpenseRow(
            name=c_item["name"],
            category=c_item["category"],
            responsible=c_item["responsible"],
            monthly_values=monthly_vals,
            total_year=total_yr
        ))

    # 5. Distribuir transações dinâmicas do banco nos meses correspondentes
    # db_monthly_sums[m_key] = { "total": float, "paid": float, "pending": float }
    db_monthly_sums = {f"{m:02d}": {"total": 0.0, "paid": 0.0, "pending": 0.0} for m in range(1, 13)}
    owners_matrix: Dict[str, Dict[str, float]] = {name: {f"{m:02d}": 0.0 for m in range(1, 13)} for name in owners_map.values()}
    categories_matrix: Dict[str, Dict[str, float]] = {name: {f"{m:02d}": 0.0 for m in range(1, 13)} for name in cats_map.values()}

    for tx in transactions:
        m_key = f"{tx.dt_lcto.month:02d}"
        val = round(tx.value, 2)
        db_monthly_sums[m_key]["total"] += val
        if tx.is_paid:
            db_monthly_sums[m_key]["paid"] += val
        else:
            db_monthly_sums[m_key]["pending"] += val

        owner_name = owners_map.get(tx.owner_id, "Rafael")
        if owner_name not in owners_matrix:
            owners_matrix[owner_name] = {f"{m:02d}": 0.0 for m in range(1, 13)}
        owners_matrix[owner_name][m_key] = round(owners_matrix[owner_name][m_key] + val, 2)

        cat_name = cats_map.get(tx.type_id, "Outros")
        if cat_name not in categories_matrix:
            categories_matrix[cat_name] = {f"{m:02d}": 0.0 for m in range(1, 13)}
        categories_matrix[cat_name][m_key] = round(categories_matrix[cat_name][m_key] + val, 2)

    # Adicionar também os custos fixos da planilha na matriz de proprietários (Rafael é o titular padrão)
    if "Rafael" not in owners_matrix:
        owners_matrix["Rafael"] = {f"{m:02d}": 0.0 for m in range(1, 13)}

    for row in fixed_rows:
        for m_key, val in row.monthly_values.items():
            owners_matrix["Rafael"][m_key] = round(owners_matrix["Rafael"][m_key] + val, 2)
            cname = row.category
            if cname not in categories_matrix:
                categories_matrix[cname] = {f"{m:02d}": 0.0 for m in range(1, 13)}
            categories_matrix[cname][m_key] = round(categories_matrix[cname][m_key] + val, 2)

    # 6. Calcular somas totais por coluna (Mês)
    monthly_columns: List[MonthlyColumnSummary] = []
    grand_total_year = 0.0

    for m in range(1, 13):
        m_key = f"{m:02d}"
        fixed_sum = sum(r.monthly_values.get(m_key, 0.0) for r in fixed_rows)
        cards_sum = sum(r.monthly_values.get(m_key, 0.0) for r in card_rows)
        variable_sum = db_monthly_sums[m_key]["total"]
        month_grand = round(fixed_sum + cards_sum + variable_sum, 2)
        grand_total_year += month_grand

        # Paid / Pending estimation
        paid_val = db_monthly_sums[m_key]["paid"]
        pending_val = db_monthly_sums[m_key]["pending"] + fixed_sum + cards_sum

        monthly_columns.append(MonthlyColumnSummary(
            month_key=m_key,
            month_name=MONTH_NAMES[m - 1],
            fixed_total=round(fixed_sum, 2),
            cards_total=round(cards_sum, 2),
            variable_total=round(variable_sum, 2),
            grand_total=month_grand,
            paid_total=round(paid_val, 2),
            pending_total=round(pending_val, 2)
        ))

    grand_total_year = round(grand_total_year, 2)

    # 7. Calcular métrica de Runway / Sobrevivência (Métrica de Ouro da Planilha)
    # Custo fixo mensal médio representativo dos meses com operação ativa
    months_with_values = [col.grand_total for col in monthly_columns if col.grand_total > 0]
    avg_burn = round(sum(months_with_values) / len(months_with_values), 2) if months_with_values else 3300.0

    months_runway = round(account_balance / avg_burn, 1) if avg_burn > 0 else 0.0
    if months_runway >= 6.0:
        h_status = "Excelente"
        h_comment = f"Reserva robusta! Você tem {months_runway} meses de cobertura para emergências."
    elif months_runway >= 4.0:
        h_status = "Adequado"
        h_comment = f"Segurança satisfatória: {months_runway} meses de fôlego financeiro na pior das hipóteses."
    elif months_runway >= 2.0:
        h_status = "Atenção"
        h_comment = f"Atenção necessária: {months_runway} meses de reserva. Recomendado reforçar o caixa."
    else:
        h_status = "Crítico"
        h_comment = f"Alerta vermelho: apenas {months_runway} meses de caixa. Priorizar cortes e entradas urgentes."

    runway_metric = RunwayMetric(
        account_balance=round(account_balance, 2),
        monthly_fixed_burn=avg_burn,
        months_of_runway=months_runway,
        health_status=h_status,
        comment=h_comment
    )

    # Totais por linha na matriz de donos e categorias
    for name, m_dict in owners_matrix.items():
        m_dict["total"] = round(sum(v for k, v in m_dict.items() if k != "total"), 2)

    for cname, m_dict in categories_matrix.items():
        m_dict["total"] = round(sum(v for k, v in m_dict.items() if k != "total"), 2)

    return MacroProjectionResponse(
        year=year,
        account_balance=round(account_balance, 2),
        runway=runway_metric,
        months=monthly_columns,
        fixed_expenses=fixed_rows,
        card_expenses=card_rows,
        owners_matrix=owners_matrix,
        categories_matrix=categories_matrix,
        grand_total_year=grand_total_year
    )
