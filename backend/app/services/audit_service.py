import logging
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog

logger = logging.getLogger("financial_organizer.audit_service")


def serialize_data(obj: Any) -> Optional[Dict[str, Any]]:
    """
    Serializa com segurança objetos SQLAlchemy, modelos Pydantic ou dicionários
    para uma estrutura limpa e compatível com JSON, tratando datas, UUIDs e floats.
    """
    if obj is None:
        return None

    if hasattr(obj, "model_dump"):
        raw_dict = obj.model_dump()
    elif hasattr(obj, "__table__"):
        raw_dict = {}
        for col in obj.__table__.columns:
            val = getattr(obj, col.name, None)
            raw_dict[col.name] = val
    elif isinstance(obj, dict):
        raw_dict = obj
    else:
        try:
            return dict(obj)
        except Exception:
            return {"raw_value": str(obj)}

    cleaned = {}
    for k, v in raw_dict.items():
        if isinstance(v, (datetime, date)):
            cleaned[k] = v.isoformat()
        elif isinstance(v, Decimal):
            cleaned[k] = float(v)
        elif isinstance(v, (list, tuple)):
            cleaned[k] = [serialize_data(item) for item in v]
        elif isinstance(v, dict):
            cleaned[k] = serialize_data(v)
        else:
            cleaned[k] = v

    return cleaned


async def record_audit_log(
    db: AsyncSession,
    action: str,  # CREATE, UPDATE, DELETE, SETTLE, SPLIT, IMPORT
    entity_type: str,  # TRANSACTION, OWNER, CARD, CATEGORY, GOAL, BANK_ACCOUNT, INVOICE
    description: str,
    entity_id: Optional[int] = None,
    old_values: Optional[Any] = None,
    new_values: Optional[Any] = None,
    actor: str = "Usuário",
    ip_address: Optional[str] = None,
    commit: bool = False,
) -> AuditLog:
    """
    Grava um registro de auditoria na tabela 'audit_logs'.
    Quando commit=False (padrão), o log é adicionado à mesma transação do banco,
    garantindo atomicidade (se a operação falhar, o log não é gravado à toa).
    """
    try:
        old_dict = serialize_data(old_values)
        new_dict = serialize_data(new_values)

        log_entry = AuditLog(
            action=action.upper().strip(),
            entity_type=entity_type.upper().strip(),
            entity_id=entity_id,
            description=description,
            old_values=old_dict,
            new_values=new_dict,
            actor=actor,
            ip_address=ip_address,
        )

        db.add(log_entry)

        if commit:
            await db.commit()
            await db.refresh(log_entry)

        return log_entry
    except Exception as e:
        logger.error(f"Erro ao registrar log de auditoria ({action} em {entity_type}): {e}", exc_info=True)
        # Não impede a operação principal em caso de falha no log
        return None
