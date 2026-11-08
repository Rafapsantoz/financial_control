from typing import Optional
from sqlalchemy import Boolean, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Goal(Base):
    __tablename__ = "goals_fapp"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    target_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    saved_amount: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="Essencial")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="Média")
    is_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    comment: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
