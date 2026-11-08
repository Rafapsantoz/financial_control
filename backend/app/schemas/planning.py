from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class GoalBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="Nome da meta ou item da lista de compras")
    target_amount: float = Field(default=0.0, ge=0.0, description="Valor alvo ou preço estimado")
    saved_amount: float = Field(default=0.0, ge=0.0, description="Valor já poupado ou pago")
    category: str = Field(default="Essencial", description="Essencial, Importante, Conforto, etc.")
    priority: str = Field(default="Média", description="Alta, Média ou Baixa")
    is_completed: bool = Field(default=False)
    comment: Optional[str] = Field(default=None, max_length=255)


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=100)
    target_amount: Optional[float] = Field(default=None, ge=0.0)
    saved_amount: Optional[float] = Field(default=None, ge=0.0)
    category: Optional[str] = None
    priority: Optional[str] = None
    is_completed: Optional[bool] = None
    comment: Optional[str] = None


class GoalResponse(GoalBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class FixedExpenseRow(BaseModel):
    name: str
    category: str
    responsible: str
    monthly_values: Dict[str, float]  # "01": 1540.0, "02": 1540.0, etc.
    total_year: float


class MonthlyColumnSummary(BaseModel):
    month_key: str  # "01" .. "12"
    month_name: str  # "Janeiro", "Fevereiro", etc.
    fixed_total: float
    cards_total: float
    variable_total: float
    grand_total: float
    paid_total: float
    pending_total: float


class RunwayMetric(BaseModel):
    account_balance: float
    monthly_fixed_burn: float
    months_of_runway: float
    health_status: str  # "Excelente", "Adequado", "Atenção", "Crítico"
    comment: str


class LivingScenario(BaseModel):
    id: str
    title: str
    city: str
    has_home_office: bool
    estimated_rent: float
    estimated_bills: float
    total_monthly: float
    annual_impact: float
    notes: str


class FinancialPrinciple(BaseModel):
    step: int
    title: str
    description: str
    category: str  # "Orçamento", "Dívidas", "Hábitos", "Metas"


class MacroProjectionResponse(BaseModel):
    year: int
    account_balance: float
    runway: RunwayMetric
    months: List[MonthlyColumnSummary]
    fixed_expenses: List[FixedExpenseRow]
    card_expenses: List[FixedExpenseRow]
    owners_matrix: Dict[str, Dict[str, float]]  # owner_name -> { "01": 100, ... "total": 1200 }
    categories_matrix: Dict[str, Dict[str, float]]  # category_name -> { "01": 200, ... "total": 2400 }
    grand_total_year: float
