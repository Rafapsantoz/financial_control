import logging
from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal, Base, engine
from app.models import Card, Category, Owner

logger = logging.getLogger("financial_organizer.init_db")

INITIAL_OWNERS = [
    {"name": "Rafael", "category": "Familiar", "phone_number": None},
    {"name": "Mãe", "category": "Familiar", "phone_number": None},
    {"name": "Irmã", "category": "Familiar", "phone_number": None},
]

INITIAL_CATEGORIES = [
    {"description": "Mercado"},
    {"description": "Lazer"},
    {"description": "Farmácia"},
    {"description": "Restaurante"},
    {"description": "Roupas"},
    {"description": "Assinaturas"},
    {"description": "Transporte"},
    {"description": "Outros"},
]

INITIAL_CARDS = [
    {"card_name": "Nubank", "total_limit": 5000.0, "payment_date": None},
]


async def init_db() -> None:
    """
    Initializes database tables and seeds standard records idempotently.
    Enforces SQLite foreign keys and WAL mode.
    """
    # 1. Create tables if they do not exist
    async with engine.begin() as conn:
        if "sqlite" in str(engine.url):
            await conn.execute(text("PRAGMA foreign_keys = ON;"))
        await conn.run_sync(Base.metadata.create_all)

    # 2. Seed initial data idempotently
    async with AsyncSessionLocal() as session:
        # Seed Owners
        for owner_data in INITIAL_OWNERS:
            stmt = select(Owner).where(Owner.name == owner_data["name"])
            existing = await session.scalar(stmt)
            if not existing:
                session.add(Owner(**owner_data))
                logger.info(f"Seeded owner: {owner_data['name']}")

        # Seed Categories
        for cat_data in INITIAL_CATEGORIES:
            stmt = select(Category).where(Category.description == cat_data["description"])
            existing = await session.scalar(stmt)
            if not existing:
                session.add(Category(**cat_data))
                logger.info(f"Seeded category: {cat_data['description']}")

        # Seed Cards
        for card_data in INITIAL_CARDS:
            stmt = select(Card).where(Card.card_name == card_data["card_name"])
            existing = await session.scalar(stmt)
            if not existing:
                session.add(Card(**card_data))
                logger.info(f"Seeded card: {card_data['card_name']}")

        await session.commit()
