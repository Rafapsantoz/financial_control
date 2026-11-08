from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.goal import Goal
from app.schemas.planning import (
    FinancialPrinciple,
    GoalCreate,
    GoalResponse,
    GoalUpdate,
    LivingScenario,
    MacroProjectionResponse,
)
from app.services.planning_service import (
    SPREADSHEET_PRINCIPLES,
    SPREADSHEET_SCENARIOS,
    compute_macro_projection,
)

router = APIRouter()


@router.get(
    "/macro-projection",
    response_model=MacroProjectionResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter projeção macro anual e mensal com cálculo de runway",
)
async def get_macro_projection(
    year: int = Query(2026, ge=2020, le=2050, description="Ano de referência"),
    account_balance: float = Query(16638.40, ge=0.0, description="Saldo disponível na conta bancária"),
    db: AsyncSession = Depends(get_db),
):
    """
    Retorna a matriz completa de 12 meses da planilha do usuário:
    - Custos fixos recorrentes (Casa, Impostos, Internet, Claro, Custo Fixo Pessoal)
    - Faturas de cartões (PicPay, Mercado Pago, Nubank Empresa)
    - Totalização consolidada por mês (Janeiro a Dezembro)
    - Métricas de sobrevivência (Runway / Meses de reserva)
    - Desdobramento cruzado por responsável e por categoria
    """
    return await compute_macro_projection(db=db, year=year, account_balance=account_balance)


@router.get(
    "/goals",
    response_model=List[GoalResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar metas financeiras e itens da lista de compras (Wishlist)",
)
async def list_goals(db: AsyncSession = Depends(get_db)):
    """Retorna todas as metas cadastradas, ordenadas por status e prioridade."""
    stmt = select(Goal).order_by(Goal.is_completed.asc(), Goal.id.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post(
    "/goals",
    response_model=GoalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastrar nova meta financeira ou item da wishlist",
)
async def create_goal(goal_in: GoalCreate, db: AsyncSession = Depends(get_db)):
    """Cria uma nova meta (ex: Cortina, Mesa, Robô aspirador)."""
    goal = Goal(**goal_in.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.put(
    "/goals/{id}",
    response_model=GoalResponse,
    status_code=status.HTTP_200_OK,
    summary="Atualizar meta financeira existente",
)
async def update_goal(id: int, goal_in: GoalUpdate, db: AsyncSession = Depends(get_db)):
    """Atualiza progresso, valor ou status de conclusão de uma meta."""
    goal = await db.get(Goal, id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meta com ID {id} não encontrada.",
        )

    update_data = goal_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)

    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete(
    "/goals/{id}",
    status_code=status.HTTP_200_OK,
    summary="Remover meta financeira",
)
async def delete_goal(id: int, db: AsyncSession = Depends(get_db)):
    """Exclui uma meta financeira."""
    goal = await db.get(Goal, id)
    if not goal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meta com ID {id} não encontrada.",
        )
    await db.delete(goal)
    await db.commit()
    return {"detail": f"Meta {id} removida com sucesso."}


@router.get(
    "/scenarios",
    response_model=List[LivingScenario],
    status_code=status.HTTP_200_OK,
    summary="Listar cenários de mudança de cidade e custo de vida",
)
async def list_scenarios():
    """Retorna os cenários comparativos da planilha (Brodowski vs Ribeirão Preto)."""
    return [LivingScenario(**s) for s in SPREADSHEET_SCENARIOS]


@router.get(
    "/principles",
    response_model=List[FinancialPrinciple],
    status_code=status.HTTP_200_OK,
    summary="Listar os 15 princípios de gestão financeira pessoal da planilha",
)
async def list_principles():
    """Retorna a metodologia prática dos 15 passos estruturada pelo usuário."""
    return [FinancialPrinciple(**p) for p in SPREADSHEET_PRINCIPLES]
