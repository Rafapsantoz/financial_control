from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CardBase(BaseModel):
    card_name: str = Field(..., min_length=1, max_length=100, description="Nome ou emissor do cartão (ex: Nubank, Inter Black)")
    payment_date: Optional[datetime] = Field(default=None, description="Data ou dia de vencimento da fatura")
    total_limit: float = Field(default=0.0, ge=0.0, description="Limite total de crédito em R$")

    @field_validator("card_name", mode="after")
    @classmethod
    def sanitize_card_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("O nome do cartão não pode ser vazio.")
        return trimmed

    @field_validator("total_limit", mode="after")
    @classmethod
    def round_limit(cls, v: float) -> float:
        return round(float(v), 2)


class CardCreate(CardBase):
    pass


class CardUpdate(BaseModel):
    card_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
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

    @field_validator("total_limit", mode="after")
    @classmethod
    def round_limit(cls, v: Optional[float]) -> Optional[float]:
        if v is not None:
            return round(float(v), 2)
        return v


class CardResponse(CardBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
