from datetime import datetime, timezone
from typing import Dict, List, Optional
from sqlalchemy import or_, select
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

# Custos fixos e cartões agora são 100% dinâmicos, derivados dos cartões e transações reais do banco
SPREADSHEET_FIXED_DEFAULTS: List[Dict] = []
SPREADSHEET_CARD_DEFAULTS: List[Dict] = []

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
    account_balance: float = 0.0,
) -> MacroProjectionResponse:
    """
    Computa a matriz anual completa de 12 meses (Janeiro a Dezembro)
    de forma 100% dinâmica a partir do banco de dados SQLite real:
    - Faturas por cartão de crédito cadastrado
    - Custos fixos / diretos (transações sem cartão vinculado)
    - Totais mensais consolidados e status pago/pendente
    - Desdobramento horizontal por responsável cadastrado (Rafael, Mãe, Irmã, Tia Renata, etc.)
    - Desdobramento horizontal por categoria real
    - Métrica de Runway / Sobrevivência baseada na queima média real
    """
    start_dt = datetime(year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(year + 1, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    # 1. Carregar todas as transações que pertencem ao ano solicitado
    # (por fatura invoice_month ou por dt_lcto)
    tx_stmt = select(Transaction).where(
        or_(
            Transaction.invoice_month.like(f"{year}-%"),
            (
                Transaction.invoice_month.is_(None)
                & (Transaction.dt_lcto >= start_dt)
                & (Transaction.dt_lcto < end_dt)
            ),
        )
    )
    tx_res = await db.execute(tx_stmt)
    transactions = tx_res.scalars().all()

    # 2. Carregar entidades mestras do banco
    owners_res = await db.execute(select(Owner).order_by(Owner.id.asc()))
    owners = owners_res.scalars().all()
    owners_map = {o.id: o.name for o in owners}

    cats_res = await db.execute(select(Category).order_by(Category.id.asc()))
    cats = cats_res.scalars().all()
    cats_map = {c.id: c.description for c in cats}

    cards_res = await db.execute(select(Card).order_by(Card.id.asc()))
    cards = cards_res.scalars().all()
    cards_map = {c.id: c.card_name for c in cards}

    def get_tx_month_key(tx: Transaction) -> Optional[str]:
        if tx.invoice_month and len(tx.invoice_month) >= 7 and tx.invoice_month.startswith(str(year)):
            m_str = tx.invoice_month[5:7]
            if m_str.isdigit() and 1 <= int(m_str) <= 12:
                return m_str
        if tx.dt_lcto and tx.dt_lcto.year == year:
            return f"{tx.dt_lcto.month:02d}"
        return None

    # 3. Montar linhas dinâmicas de cartões de crédito
    card_rows: List[FixedExpenseRow] = []
    for c in cards:
        c_vals = {f"{m:02d}": 0.0 for m in range(1, 13)}
        for tx in transactions:
            if tx.card_id == c.id:
                m_k = get_tx_month_key(tx)
                if m_k:
                    c_vals[m_k] = round(c_vals[m_k] + tx.value, 2)
        tot_yr = round(sum(c_vals.values()), 2)
        card_rows.append(
            FixedExpenseRow(
                name=c.card_name,
                category="Cartão de Crédito",
                responsible="Titular / Familiar",
                monthly_values=c_vals,
                total_year=tot_yr,
            )
        )

    # 4. Montar linhas de custos fixos / diretos (transações onde card_id is None)
    direct_txs = [tx for tx in transactions if tx.card_id is None]
    direct_groups: Dict[str, Dict[str, float]] = {}
    direct_meta: Dict[str, Dict[str, str]] = {}

    for tx in direct_txs:
        desc = tx.description.strip()
        if desc not in direct_groups:
            direct_groups[desc] = {f"{m:02d}": 0.0 for m in range(1, 13)}
            direct_meta[desc] = {
                "category": cats_map.get(tx.type_id, "Geral"),
                "responsible": owners_map.get(tx.owner_id, "Rafael"),
            }
        m_k = get_tx_month_key(tx)
        if m_k:
            direct_groups[desc][m_k] = round(direct_groups[desc][m_k] + tx.value, 2)

    fixed_rows: List[FixedExpenseRow] = []
    for desc, m_vals in direct_groups.items():
        tot_yr = round(sum(m_vals.values()), 2)
        fixed_rows.append(
            FixedExpenseRow(
                name=desc,
                category=direct_meta[desc]["category"],
                responsible=direct_meta[desc]["responsible"],
                monthly_values=m_vals,
                total_year=tot_yr,
            )
        )

    # 5. Montar matriz de responsáveis (De Quem São as Contas)
    owners_matrix: Dict[str, Dict[str, float]] = {
        o.name: {f"{m:02d}": 0.0 for m in range(1, 13)} for o in owners
    }
    for tx in transactions:
        o_name = owners_map.get(tx.owner_id, "Rafael")
        if o_name not in owners_matrix:
            owners_matrix[o_name] = {f"{m:02d}": 0.0 for m in range(1, 13)}
        m_k = get_tx_month_key(tx)
        if m_k:
            owners_matrix[o_name][m_k] = round(owners_matrix[o_name][m_k] + tx.value, 2)

    for o_name, m_dict in owners_matrix.items():
        m_dict["total"] = round(sum(v for k, v in m_dict.items() if k != "total"), 2)

    # 6. Montar matriz de categorias
    categories_matrix: Dict[str, Dict[str, float]] = {
        c.description: {f"{m:02d}": 0.0 for m in range(1, 13)} for c in cats
    }
    for tx in transactions:
        c_name = cats_map.get(tx.type_id, "Outros")
        if c_name not in categories_matrix:
            categories_matrix[c_name] = {f"{m:02d}": 0.0 for m in range(1, 13)}
        m_k = get_tx_month_key(tx)
        if m_k:
            categories_matrix[c_name][m_k] = round(categories_matrix[c_name][m_k] + tx.value, 2)

    for c_name, m_dict in categories_matrix.items():
        m_dict["total"] = round(sum(v for k, v in m_dict.items() if k != "total"), 2)

    # 7. Totalizar as colunas mensais (Janeiro a Dezembro)
    monthly_columns: List[MonthlyColumnSummary] = []
    grand_total_year = 0.0

    for m in range(1, 13):
        m_key = f"{m:02d}"
        txs_month = [tx for tx in transactions if get_tx_month_key(tx) == m_key]
        fixed_sum = round(sum(tx.value for tx in txs_month if tx.card_id is None), 2)
        cards_sum = round(sum(tx.value for tx in txs_month if tx.card_id is not None), 2)
        month_grand = round(fixed_sum + cards_sum, 2)
        grand_total_year += month_grand

        paid_val = round(sum(tx.value for tx in txs_month if tx.is_paid), 2)
        pending_val = round(sum(tx.value for tx in txs_month if not tx.is_paid), 2)

        monthly_columns.append(
            MonthlyColumnSummary(
                month_key=m_key,
                month_name=MONTH_NAMES[m - 1],
                fixed_total=fixed_sum,
                cards_total=cards_sum,
                variable_total=0.0,
                grand_total=month_grand,
                paid_total=paid_val,
                pending_total=pending_val,
            )
        )

    grand_total_year = round(grand_total_year, 2)

    # 8. Métrica de Sobrevivência (Runway)
    months_with_values = [col.grand_total for col in monthly_columns if col.grand_total > 0]
    if months_with_values:
        avg_burn = round(sum(months_with_values) / len(months_with_values), 2)
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
        elif months_runway > 0:
            h_status = "Crítico"
            h_comment = f"Alerta vermelho: apenas {months_runway} meses de caixa. Priorizar cortes e entradas urgentes."
        else:
            h_status = "Neutro"
            h_comment = "Insira o saldo em conta para calcular os meses de sobrevivência."
    else:
        avg_burn = 0.0
        months_runway = 0.0
        h_status = "Aguardando Lançamentos"
        h_comment = "Nenhuma despesa lançada para o ano selecionado. Lance suas faturas para ativar a projeção de runway."

    runway_metric = RunwayMetric(
        account_balance=round(account_balance, 2),
        monthly_fixed_burn=avg_burn,
        months_of_runway=months_runway,
        health_status=h_status,
        comment=h_comment,
    )

    return MacroProjectionResponse(
        year=year,
        account_balance=round(account_balance, 2),
        runway=runway_metric,
        months=monthly_columns,
        fixed_expenses=fixed_rows,
        card_expenses=card_rows,
        owners_matrix=owners_matrix,
        categories_matrix=categories_matrix,
        grand_total_year=grand_total_year,
    )
