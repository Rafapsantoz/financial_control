from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class OwnerSummary(BaseModel):
    owner_id: int = Field(..., description="ID do responsável cadastrado")
    owner_name: str = Field(..., description="Nome do responsável (ex: Rafael, Mãe, Irmã)")
    total_amount: float = Field(..., description="Total de gastos atribuídos no mês em R$")
    paid_amount: float = Field(..., description="Total já quitado no mês em R$")
    pending_amount: float = Field(..., description="Total ainda pendente de quitação no mês em R$")
    status: str = Field(
        ...,
        description="Status individual de quitação: 'Pago', 'Pendente', 'Parcial', 'Sem despesas'",
    )
    transactions_count: int = Field(..., ge=0, description="Quantidade de transações do responsável no mês")

    model_config = ConfigDict(from_attributes=True)


class CategorySummary(BaseModel):
    category_id: int = Field(..., description="ID da categoria")
    category_name: str = Field(..., description="Nome da categoria")
    total_amount: float = Field(..., description="Total gasto na categoria no mês em R$")
    percentage: float = Field(..., description="Percentual em relação ao total da fatura (0.0 a 100.0%)")

    model_config = ConfigDict(from_attributes=True)


class DashboardSummaryResponse(BaseModel):
    month: str = Field(..., description="Mês de referência no formato YYYY-MM")
    card_id: Optional[int] = Field(default=None, description="ID do cartão filtrado, se aplicável")
    total_amount: float = Field(..., description="Valor total consolidado da fatura no mês em R$")
    total_paid: float = Field(..., description="Valor total já quitado da fatura em R$")
    total_pending: float = Field(..., description="Valor total pendente de quitação da fatura em R$")
    owners_summary: List[OwnerSummary] = Field(
        default_factory=list,
        description="Subtotais e status individual de quitação de cada membro da família",
    )
    category_summary: List[CategorySummary] = Field(
        default_factory=list,
        description="Desdobramento dos gastos por categoria com percentual em relação ao total",
    )

    model_config = ConfigDict(from_attributes=True)
