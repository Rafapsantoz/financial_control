from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogListResponse, AuditLogResponse

router = APIRouter()


@router.get("", response_model=AuditLogListResponse, status_code=status.HTTP_200_OK)
async def list_audit_logs(
    entity_type: Optional[str] = Query(None, description="Filtrar por tipo de entidade (ex: TRANSACTION, OWNER, CARD, etc.)"),
    action: Optional[str] = Query(None, description="Filtrar por tipo de ação (CREATE, UPDATE, DELETE, SETTLE, etc.)"),
    entity_id: Optional[int] = Query(None, description="Filtrar por ID da entidade"),
    search: Optional[str] = Query(None, description="Busca textual na descrição do log"),
    skip: int = Query(0, ge=0, description="Pular N registros"),
    limit: int = Query(50, ge=1, le=200, description="Limite de registros por página"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna o histórico completo de auditoria do sistema com suporte a paginação e filtros.
    Garante rastreabilidade total de inclusões, alterações e exclusões.
    """
    stmt = select(AuditLog)
    count_stmt = select(func.count(AuditLog.id))

    if entity_type:
        stmt = stmt.where(func.upper(AuditLog.entity_type) == entity_type.upper().strip())
        count_stmt = count_stmt.where(func.upper(AuditLog.entity_type) == entity_type.upper().strip())

    if action:
        stmt = stmt.where(func.upper(AuditLog.action) == action.upper().strip())
        count_stmt = count_stmt.where(func.upper(AuditLog.action) == action.upper().strip())

    if entity_id is not None:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
        count_stmt = count_stmt.where(AuditLog.entity_id == entity_id)

    if search and search.strip():
        term = f"%{search.strip()}%"
        search_filter = or_(
            AuditLog.description.ilike(term),
            AuditLog.actor.ilike(term),
        )
        stmt = stmt.where(search_filter)
        count_stmt = count_stmt.where(search_filter)

    total = await db.scalar(count_stmt) or 0
    stmt = stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(skip).limit(limit)

    result = await db.execute(stmt)
    items = result.scalars().all()

    return AuditLogListResponse(total=total, items=items)


@router.get("/stats", status_code=status.HTTP_200_OK)
async def get_audit_stats(db: AsyncSession = Depends(get_db)):
    """Retorna estatísticas consolidadas dos logs de auditoria."""
    total = await db.scalar(select(func.count(AuditLog.id))) or 0

    # Agrupamento por ação
    action_counts_res = await db.execute(
        select(AuditLog.action, func.count(AuditLog.id)).group_by(AuditLog.action)
    )
    action_counts = {row[0]: row[1] for row in action_counts_res.fetchall()}

    # Agrupamento por entidade
    entity_counts_res = await db.execute(
        select(AuditLog.entity_type, func.count(AuditLog.id)).group_by(AuditLog.entity_type)
    )
    entity_counts = {row[0]: row[1] for row in entity_counts_res.fetchall()}

    return {
        "total_logs": total,
        "by_action": action_counts,
        "by_entity": entity_counts,
    }


@router.get("/{id}", response_model=AuditLogResponse, status_code=status.HTTP_200_OK)
async def get_audit_log(id: int, db: AsyncSession = Depends(get_db)):
    """Retorna o detalhe de um registro de log por ID (incluindo snapshots old_values e new_values)."""
    log_entry = await db.get(AuditLog, id)
    if not log_entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Registro de log #{id} não encontrado.",
        )
    return log_entry
