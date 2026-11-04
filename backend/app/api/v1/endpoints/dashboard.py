from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.dashboard import DashboardSummaryResponse
from app.services.dashboard_service import get_dashboard_summary

router = APIRouter()


@router.get(
    "/summary",
    response_model=DashboardSummaryResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter resumo da fatura mensal com rateio familiar e desdobramento por categoria",
    description="Calcula o rateio familiar (Rafael, Mãe, Irmã), status individual de quitação (RN03), conservação de valores e gastos por categoria.",
)
async def get_summary(
    month: str = Query(
        ...,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        description="Mês de referência no formato YYYY-MM (ex: 2026-11)",
    ),
    card_id: Optional[int] = Query(
        None,
        description="Filtrar opcionalmente por ID de um cartão de crédito específico",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint para fechamento mensal e rateio familiar.
    Retorna os subtotais devidos por membro da família (Rafael, Mãe, Irmã),
    seus status individuais de quitação ('Pago', 'Pendente', 'Parcial', 'Sem despesas'),
    e desdobramento proporcional por categoria de gasto.
    """
    return await get_dashboard_summary(db=db, month=month, card_id=card_id)
