from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CardBase(BaseModel):
    card_name: str = Field(..., min_length=1, max_length=100, description="Nome ou emissor do cartão (ex: Nubank, Inter Black)")
    due_day: Optional[int] = Field(default=None, ge=1, le=31, description="Dia do vencimento da fatura (1 a 31)")
    payment_date: Optional[datetime] = Field(default=None, description="Legado: Data de vencimento")
    total_limit: float = Field(default=0.0, ge=0.0, description="Limite total de crédito em R$")

    @field_validator("card_name", mode="after")
    @classmethod
    def sanitize_card_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("O nome do cartão não pode ser vazio.")
        return trimmed

    @field_validator("due_day", mode="before")
    @classmethod
    def validate_due_day(cls, v: Optional[object]) -> Optional[int]:
        if v is None or v == "":
            return None
        try:
            val = int(v)
            if val < 1 or val > 31:
                raise ValueError("O dia de vencimento deve estar entre 1 e 31.")
            return val
        except (ValueError, TypeError):
            raise ValueError("O dia de vencimento deve ser um número inteiro entre 1 e 31.")

    @field_validator("total_limit", mode="after")
    @classmethod
    def round_limit(cls, v: float) -> float:
        return round(float(v), 2)


class CardCreate(CardBase):
    pass


class CardUpdate(BaseModel):
    card_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    due_day: Optional[int] = Field(default=None, ge=1, le=31, description="Dia do vencimento da fatura (1 a 31)")
    payment_date: Optional[datetime] = Field(default=None)
    total_limit: Optional[float] = Field(default=None, ge=0.0)

    @field_validator("card_name", mode="after")
    @classmethod
    def sanitize_card_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("O nome do cartão não pode ser vazio.")
            return trimmed
        return v

    @field_validator("due_day", mode="before")
    @classmethod
    def validate_due_day(cls, v: Optional[object]) -> Optional[int]:
        if v is None or v == "":
            return None
        try:
            val = int(v)
            if val < 1 or val > 31:
                raise ValueError("O dia de vencimento deve estar entre 1 e 31.")
            return val
        except (ValueError, TypeError):
            raise ValueError("O dia de vencimento deve ser um número inteiro entre 1 e 31.")

    @field_validator("total_limit", mode="after")
    @classmethod
    def round_limit(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return round(float(v), 2)
        return v


class CardResponse(CardBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
