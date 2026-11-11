from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class OwnerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Nome do responsável (ex: Rafael, Mãe, Irmã)")
    category: str = Field(default="Familiar", max_length=50, description="Categoria do participante (ex: Familiar, Pessoal)")
    phone_number: Optional[str] = Field(default=None, max_length=30, description="Telefone / WhatsApp")

    @field_validator("name", mode="after")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("O nome do proprietário não pode ser vazio.")
        return trimmed


class OwnerCreate(OwnerBase):
    pass


class OwnerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    category: Optional[str] = Field(default=None, max_length=50)
    phone_number: Optional[str] = Field(default=None, max_length=30)

    @field_validator("name", mode="after")
    @classmethod
    def sanitize_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("O nome do proprietário não pode ser vazio.")
            return trimmed
        return v


class OwnerResponse(OwnerBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class OwnerSettleRequest(BaseModel):
    payment_amount: float = Field(..., gt=0.0, description="Valor pago em R$ a ser rateado e abatido")
    month: str = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$", description="Mês de competência (YYYY-MM)")


class OwnerSettleResponse(BaseModel):
    owner_id: int
    settled_amount: float
    fully_settled_count: int
    partially_settled_count: int
    remaining_pending: float
    message: str
