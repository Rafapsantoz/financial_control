from datetime import datetime, timezone
from typing import TYPE_CHECKING, Optional
from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.card import Card


class InvoiceUpload(Base):
    __tablename__ = "invoice_uploads_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    file_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    card_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("cards_fapp.id"), nullable=True)
    target_month: Mapped[str] = mapped_column(String(7), nullable=False, index=True)  # YYYY-MM
    bank_or_issuer: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    items_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="CONFIRMED")

    card: Mapped[Optional["Card"]] = relationship("Card", lazy="selectin")
