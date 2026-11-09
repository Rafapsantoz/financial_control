from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Transaction(Base):
    __tablename__ = "transactions_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    dt_lcto: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        server_default=func.now(),
        index=True,
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    value: Mapped[float] = mapped_column(Float, nullable=False)

    # Foreign Keys with RESTRICT on delete
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("owners_fapp.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    card_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("cards_fapp.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )
    type_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("type_fapp.id", ondelete="RESTRICT"),
        nullable=True,
        index=True,
    )

    # Installment fields
    total_parcs: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    cur_parcs: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")

    # Status & Billing cycle flags
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0", index=True)
    is_forecast: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="0", index=True)
    invoice_month: Mapped[Optional[str]] = mapped_column(String(7), nullable=True, index=True)
    comment: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships configured with selectin loading to prevent MissingGreenlet
    owner: Mapped[Optional["Owner"]] = relationship("Owner", back_populates="transactions", lazy="selectin")
    card: Mapped[Optional["Card"]] = relationship("Card", back_populates="transactions", lazy="selectin")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="transactions", lazy="selectin")
