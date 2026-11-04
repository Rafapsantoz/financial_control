from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TransactionBase(BaseModel):
    dt_lcto: datetime = Field(default_factory=utc_now, description="Data do lançamento ou compra")
    description: str = Field(..., min_length=1, max_length=255, description="Descrição do estabelecimento ou item")
    value: float = Field(..., gt=0.0, description="Valor da transação em R$ (positivo)")
    owner_id: Optional[int] = Field(default=None, description="ID do responsável (owners_fapp)")
    card_id: Optional[int] = Field(default=None, description="ID do cartão de crédito (cards_fapp)")
    type_id: Optional[int] = Field(default=None, description="ID da categoria (type_fapp)")
    total_parcs: int = Field(default=1, ge=1, description="Total de parcelas (ex: 1 para à vista, 10 para 10x)")
    cur_parcs: int = Field(default=1, ge=1, description="Parcela atual (ex: 1, 2, 3...)")
    comment: Optional[str] = Field(default=None, max_length=500, description="Observação livre")
    is_paid: bool = Field(default=False, description="Status de quitação da dívida pelo responsável")
    is_forecast: bool = Field(default=False, description="Indica se é parcela projetada para faturas futuras")

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_description(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("A descrição da transação não pode ser vazia.")
        return trimmed

    @field_validator("value", mode="after")
    @classmethod
    def round_value(cls, v: float) -> float:
        return round(float(v), 2)

    @model_validator(mode="after")
    def validate_installments(self) -> "TransactionBase":
        if self.cur_parcs > self.total_parcs:
            raise ValueError(
                f"A parcela atual ({self.cur_parcs}) não pode ser maior que o total de parcelas ({self.total_parcs})."
            )
        return self


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    dt_lcto: Optional[datetime] = None
    description: Optional[str] = Field(default=None, min_length=1, max_length=255)
    value: Optional[float] = Field(default=None, gt=0.0)
    owner_id: Optional[int] = None
    card_id: Optional[int] = None
    type_id: Optional[int] = None
    total_parcs: Optional[int] = Field(default=None, ge=1)
    cur_parcs: Optional[int] = Field(default=None, ge=1)
    comment: Optional[str] = Field(default=None, max_length=500)
    is_paid: Optional[bool] = None
    is_forecast: Optional[bool] = None

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("A descrição da transação não pode ser vazia.")
            return trimmed
        return v

    @field_validator("value", mode="after")
    @classmethod
    def round_value(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return round(float(v), 2)
        return v

    @model_validator(mode="after")
    def validate_installments(self) -> "TransactionUpdate":
        if self.cur_parcs is not None and self.total_parcs is not None:
            if self.cur_parcs > self.total_parcs:
                raise ValueError(
                    f"A parcela atual ({self.cur_parcs}) não pode ser maior que o total de parcelas ({self.total_parcs})."
                )
        return self


class TransactionResponse(TransactionBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
