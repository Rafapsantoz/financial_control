from datetime import datetime
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.transaction import Transaction


class Card(Base):
    __tablename__ = "cards_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    card_name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    payment_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_limit: Mapped[float] = mapped_column(Float, nullable=False, default=0.0, server_default="0.0")

    # One-to-many relationship with transactions (No cascade delete)
    transactions: Mapped[List["Transaction"]] = relationship(
        "Transaction",
        back_populates="card",
        lazy="selectin",
    )
