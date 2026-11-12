from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class BankAccountBalanceItem(BaseModel):
    owner_id: int = Field(..., description="ID do responsável/membro")
    owner_name: Optional[str] = Field(default=None, description="Nome do responsável")
    balance: float = Field(default=0.0, ge=0.0, description="Saldo pertencente a este membro nesta conta")

    model_config = ConfigDict(from_attributes=True)


class BankAccountBalanceUpdatePayload(BaseModel):
    balances: List[BankAccountBalanceItem] = Field(..., description="Lista de saldos por responsável")


class BankAccountBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Nome da conta (ex: Nubank, PicPay, Inter)")
    account_type: str = Field(default="Conta Pagamento / CDI", max_length=50, description="Tipo da conta")
    cdi_rate: float = Field(default=100.0, ge=0.0, description="Percentual do CDI (ex: 100% ou 105%)")
    cdi_monthly_rate: float = Field(default=0.85, ge=0.0, description="Rendimento mensal informado manualmente em % (ex: 0.85% a.m.)")
    notes: Optional[str] = Field(default=None, description="Observações adicionais")

    @field_validator("name", mode="after")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("O nome da conta bancária não pode ser vazio.")
        return trimmed


class BankAccountCreate(BankAccountBase):
    initial_balances: Optional[List[BankAccountBalanceItem]] = Field(
        default=None,
        description="Saldos iniciais por membro familiar",
    )


class BankAccountUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    account_type: Optional[str] = Field(default=None, max_length=50)
    cdi_rate: Optional[float] = Field(default=None, ge=0.0)
    cdi_monthly_rate: Optional[float] = Field(default=None, ge=0.0)
    notes: Optional[str] = None

    @field_validator("name", mode="after")
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("O nome da conta bancária não pode ser vazio.")
            return trimmed
        return v


class BankAccountResponse(BankAccountBase):
    id: int
    balances: List[BankAccountBalanceItem] = []

    # Cálculos dinâmicos
    total_balance: float = 0.0          # Tot = soma dos saldos de todos os membros
    monthly_yield: float = 0.0          # Tot * rendimento
    others_balance: float = 0.0         # Total pertencente a outros familiares (Mãe, Irmã, etc.)
    owner_balance: float = 0.0          # Saldo próprio do Rafael
    net_with_yield: float = 0.0         # Fórmula solicitada: Tot * rendimento - TotalOutros (ou Saldo Rafael + Rendimento)

    model_config = ConfigDict(from_attributes=True)


class BankAccountsSummaryResponse(BaseModel):
    accounts: List[BankAccountResponse] = []
    grand_total_balance: float = 0.0
    grand_total_monthly_yield: float = 0.0
    grand_total_others: float = 0.0
    grand_total_owner: float = 0.0
    grand_total_net_with_yield: float = 0.0
