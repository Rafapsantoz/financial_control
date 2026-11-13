from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Integer, JSON, String, Text
from app.core.database import Base


class AuditLog(Base):
    """
    Tabela de Auditoria e Logs de Operações do Sistema.
    Registra inclusões, alterações e exclusões com snapshots completos (old_values e new_values)
    para garantir rastreabilidade total e proteção contra perda acidental de informações.
    """
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    entity_type = Column(String(50), nullable=False, index=True)  # TRANSACTION, OWNER, CARD, CATEGORY, GOAL, BANK_ACCOUNT, INVOICE
    entity_id = Column(Integer, nullable=True, index=True)
    action = Column(String(20), nullable=False, index=True)  # CREATE, UPDATE, DELETE, SETTLE, SPLIT, IMPORT
    description = Column(Text, nullable=False)
    old_values = Column(JSON, nullable=True)  # Snapshot antes da alteração ou exclusão
    new_values = Column(JSON, nullable=True)  # Snapshot após a inclusão ou alteração
    actor = Column(String(100), default="Usuário", nullable=False)
    ip_address = Column(String(45), nullable=True)
