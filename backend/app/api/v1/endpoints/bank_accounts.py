from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.bank_account import BankAccount, BankAccountBalance
from app.models.owner import Owner
from app.schemas.bank_account import (
    BankAccountBalanceItem,
    BankAccountBalanceUpdatePayload,
    BankAccountCreate,
    BankAccountResponse,
    BankAccountUpdate,
    BankAccountsSummaryResponse,
)

router = APIRouter()


async def _enrich_bank_account(account: BankAccount, owners_map: dict) -> BankAccountResponse:
    """Calcula os totais, rendimentos do CDI e a divisão entre Rafael e outros membros."""
    balances_list: List[BankAccountBalanceItem] = []
    tot_balance = 0.0
    others_balance = 0.0
    owner_balance = 0.0

    # Percorrer saldos cadastrados
    for b in account.balances:
        o = owners_map.get(b.owner_id)
        o_name = o.name if o else f"Membro #{b.owner_id}"
        val = round(b.balance or 0.0, 2)
        tot_balance += val

        is_rafael = False
        if o:
            is_rafael = "rafael" in o.name.lower() or "titular" in (o.category or "").lower()

        if is_rafael:
            owner_balance += val
        else:
            others_balance += val

        balances_list.append(
            BankAccountBalanceItem(
                owner_id=b.owner_id,
                owner_name=o_name,
                balance=val,
            )
        )

    # Taxa mensal informada (ex: 0.85%)
    monthly_rate = (account.cdi_monthly_rate or 0.85) / 100.0
    monthly_yield = round(tot_balance * monthly_rate, 2)

    # Rafael fica com todo o rendimento gerado pela conta toda (inclusive sobre a parte da mãe)
    # Fórmula: Tot * rendimento - total de outros (Saldo do Rafael + Rendimento total retido)
    net_with_yield = round(owner_balance + monthly_yield, 2)

    return BankAccountResponse(
        id=account.id,
        name=account.name,
        account_type=account.account_type,
        cdi_rate=account.cdi_rate,
        cdi_monthly_rate=account.cdi_monthly_rate,
        notes=account.notes,
        balances=balances_list,
        total_balance=round(tot_balance, 2),
        monthly_yield=monthly_yield,
        others_balance=round(others_balance, 2),
        owner_balance=round(owner_balance, 2),
        net_with_yield=net_with_yield,
    )


@router.get("", response_model=List[BankAccountResponse], status_code=status.HTTP_200_OK)
async def list_bank_accounts(db: AsyncSession = Depends(get_db)):
    """Listar todas as contas bancárias com saldos e rendimentos calculados."""
    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}

    stmt = select(BankAccount).order_by(BankAccount.id.asc())
    res = await db.execute(stmt)
    accounts = res.scalars().all()

    return [await _enrich_bank_account(acc, owners_map) for acc in accounts]


@router.get("/summary", response_model=BankAccountsSummaryResponse, status_code=status.HTTP_200_OK)
async def get_bank_accounts_summary(db: AsyncSession = Depends(get_db)):
    """Retorna o resumo global consolidado de contas, saldos e rendimentos CDI."""
    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}

    stmt = select(BankAccount).order_by(BankAccount.id.asc())
    res = await db.execute(stmt)
    accounts = res.scalars().all()

    enriched_accounts = [await _enrich_bank_account(acc, owners_map) for acc in accounts]

    grand_total_balance = round(sum(a.total_balance for a in enriched_accounts), 2)
    grand_total_yield = round(sum(a.monthly_yield for a in enriched_accounts), 2)
    grand_total_others = round(sum(a.others_balance for a in enriched_accounts), 2)
    grand_total_owner = round(sum(a.owner_balance for a in enriched_accounts), 2)
    grand_total_net = round(sum(a.net_with_yield for a in enriched_accounts), 2)

    return BankAccountsSummaryResponse(
        accounts=enriched_accounts,
        grand_total_balance=grand_total_balance,
        grand_total_monthly_yield=grand_total_yield,
        grand_total_others=grand_total_others,
        grand_total_owner=grand_total_owner,
        grand_total_net_with_yield=grand_total_net,
    )


@router.post("", response_model=BankAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_bank_account(payload: BankAccountCreate, db: AsyncSession = Depends(get_db)):
    """Cadastrar nova conta bancária com opção de saldos iniciais por membro."""
    # Verificar duplicidade de nome
    existing = await db.execute(
        select(BankAccount).where(func.lower(BankAccount.name) == func.lower(payload.name))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conta bancária '{payload.name}' já está cadastrada.",
        )

    acc = BankAccount(
        name=payload.name,
        account_type=payload.account_type,
        cdi_rate=payload.cdi_rate,
        cdi_monthly_rate=payload.cdi_monthly_rate,
        notes=payload.notes,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)

    # Inserir saldos iniciais se fornecidos
    if payload.initial_balances:
        for b in payload.initial_balances:
            bal = BankAccountBalance(
                bank_account_id=acc.id,
                owner_id=b.owner_id,
                balance=b.balance,
            )
            db.add(bal)
        await db.commit()
        await db.refresh(acc)

    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}
    return await _enrich_bank_account(acc, owners_map)


@router.get("/{id}", response_model=BankAccountResponse, status_code=status.HTTP_200_OK)
async def get_bank_account(id: int, db: AsyncSession = Depends(get_db)):
    """Obter detalhes de uma conta bancária específica."""
    acc = await db.get(BankAccount, id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conta bancária #{id} não encontrada.",
        )

    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}
    return await _enrich_bank_account(acc, owners_map)


@router.put("/{id}", response_model=BankAccountResponse, status_code=status.HTTP_200_OK)
async def update_bank_account(
    id: int,
    payload: BankAccountUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Atualizar dados da conta bancária (nome, tipo, % CDI, taxa mensal)."""
    acc = await db.get(BankAccount, id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conta bancária #{id} não encontrada.",
        )

    if payload.name and payload.name.lower() != acc.name.lower():
        existing = await db.execute(
            select(BankAccount).where(
                func.lower(BankAccount.name) == func.lower(payload.name),
                BankAccount.id != id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Outra conta com o nome '{payload.name}' já existe.",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(acc, field, val)

    await db.commit()
    await db.refresh(acc)

    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}
    return await _enrich_bank_account(acc, owners_map)


@router.put("/{id}/balances", response_model=BankAccountResponse, status_code=status.HTTP_200_OK)
async def update_bank_account_balances(
    id: int,
    payload: BankAccountBalanceUpdatePayload,
    db: AsyncSession = Depends(get_db),
):
    """Atualizar os saldos de cada membro familiar nesta conta bancária."""
    acc = await db.get(BankAccount, id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conta bancária #{id} não encontrada.",
        )

    # Remover saldos anteriores
    for old_bal in list(acc.balances):
        await db.delete(old_bal)
    await db.flush()

    # Adicionar novos saldos informados
    for item in payload.balances:
        new_bal = BankAccountBalance(
            bank_account_id=acc.id,
            owner_id=item.owner_id,
            balance=item.balance,
        )
        db.add(new_bal)

    await db.commit()
    await db.refresh(acc)

    owners_res = await db.execute(select(Owner))
    owners_map = {o.id: o for o in owners_res.scalars().all()}
    return await _enrich_bank_account(acc, owners_map)


@router.delete("/{id}", status_code=status.HTTP_200_OK)
async def delete_bank_account(id: int, db: AsyncSession = Depends(get_db)):
    """Excluir conta bancária e seus saldos."""
    acc = await db.get(BankAccount, id)
    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conta bancária #{id} não encontrada.",
        )

    await db.delete(acc)
    await db.commit()
    return {"detail": f"Conta bancária '{acc.name}' excluída com sucesso."}
