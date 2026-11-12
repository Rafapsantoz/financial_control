from typing import TYPE_CHECKING, List
from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Category(Base):
    __tablename__ = "type_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    description: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    fixed_cost: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # One-to-many relationship with transactions (No cascade delete)
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="category",
        lazy="selectin",
    )
