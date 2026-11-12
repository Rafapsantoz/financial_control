from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CategoryBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=100, description="Descrição da categoria (ex: Mercado, Lazer, Farmácia)")
    fixed_cost: float = Field(default=0.0, ge=0.0, description="Custo fixo mensal orçado para esta categoria")

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_description(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("A descrição da categoria não pode ser vazia.")
        return trimmed


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    description: Optional[str] = Field(default=None, min_length=1, max_length=100)
    fixed_cost: Optional[float] = Field(default=None, ge=0.0)

    @field_validator("description", mode="after")
    @classmethod
    def sanitize_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            trimmed = v.strip()
            if not trimmed:
                raise ValueError("A descrição da categoria não pode ser vazia.")
            return trimmed
        return v


class CategoryResponse(CategoryBase):
    id: int
    fixed_cost: float = 0.0

    model_config = ConfigDict(from_attributes=True)
