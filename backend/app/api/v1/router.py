from fastapi import APIRouter
from app.api.v1.endpoints import owners, cards, categories, transactions

api_router = APIRouter()

api_router.include_router(owners.router, prefix="/owners", tags=["Owners"])
api_router.include_router(cards.router, prefix="/cards", tags=["Cards"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
