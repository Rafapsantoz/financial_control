from datetime import datetime, timezone
from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.owner import Owner


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(50), default="Conta Pagamento / CDI", nullable=False)
    cdi_rate: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)  # % do CDI (ex: 100%)
    cdi_monthly_rate: Mapped[float] = mapped_column(Float, default=0.85, nullable=False)  # Taxa mensal informada (ex: 0.85%)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relacionamento com os saldos por membro da família
    balances: Mapped[List["BankAccountBalance"]] = relationship(
        "BankAccountBalance",
        back_populates="bank_account",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class BankAccountBalance(Base):
    __tablename__ = "bank_account_balances"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    bank_account_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("bank_accounts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    owner_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("owners_fapp.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    bank_account: Mapped["BankAccount"] = relationship(
        "BankAccount",
        back_populates="balances",
    )
    owner: Mapped["Owner"] = relationship(
        "Owner",
        lazy="selectin",
    )
