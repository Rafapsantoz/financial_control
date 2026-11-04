from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Owner(Base):
    __tablename__ = "owners_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="Familiar", server_default="Familiar")
    phone_number: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # One-to-many relationship with transactions (No cascade delete)
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="owner",
        lazy="selectin",
    )
