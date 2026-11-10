import logging
from sqlalchemy import func, select, text
from app.core.database import AsyncSessionLocal, Base, engine
from app.models import Card, Category, Goal, Owner

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
    {"description": "Gastos Previstos"},
]

INITIAL_CARDS = [
    {"card_name": "Nubank", "total_limit": 5000.0, "payment_date": None, "due_day": 10},
]

INITIAL_GOALS = []


async def init_db() -> None:
    """
    Initializes database tables and seeds standard records idempotently.
    Enforces SQLite foreign keys, WAL mode, and automatic schema migrations.
    Only seeds baseline master records if the corresponding tables are empty.
    """
    # 1. Create tables if they do not exist
    async with engine.begin() as conn:
        if "sqlite" in str(engine.url):
            await conn.execute(text("PRAGMA foreign_keys = ON;"))
        await conn.run_sync(Base.metadata.create_all)

        # SQLite automatic migration check for due_day column in cards_fapp
        if "sqlite" in str(engine.url):
            try:
                res = await conn.execute(text("PRAGMA table_info(cards_fapp);"))
                cols = [row[1] for row in res.fetchall()]
                if "due_day" not in cols:
                    await conn.execute(text("ALTER TABLE cards_fapp ADD COLUMN due_day INTEGER;"))
                    logger.info("Migrated cards_fapp: added due_day column.")
            except Exception as e:
                logger.warning(f"Error checking/migrating cards_fapp table: {e}")

            # SQLite automatic migration check for invoice_month column in transactions_fapp
            try:
                res_tx = await conn.execute(text("PRAGMA table_info(transactions_fapp);"))
                cols_tx = [row[1] for row in res_tx.fetchall()]
                if "invoice_month" not in cols_tx:
                    await conn.execute(text("ALTER TABLE transactions_fapp ADD COLUMN invoice_month VARCHAR(7);"))
                    logger.info("Migrated transactions_fapp: added invoice_month column.")
            except Exception as e:
                logger.warning(f"Error checking/migrating transactions_fapp table: {e}")

    # 2. Seed initial data idempotently (only if tables are empty)
    async with AsyncSessionLocal() as session:
        # Seed Owners
        owner_count = await session.scalar(select(func.count(Owner.id)))
        if owner_count == 0:
            for owner_data in INITIAL_OWNERS:
                session.add(Owner(**owner_data))
                logger.info(f"Seeded owner: {owner_data['name']}")

        # Seed Categories
        cat_count = await session.scalar(select(func.count(Category.id)))
        if cat_count == 0:
            for cat_data in INITIAL_CATEGORIES:
                session.add(Category(**cat_data))
                logger.info(f"Seeded category: {cat_data['description']}")

        # Seed Cards
        card_count = await session.scalar(select(func.count(Card.id)))
        if card_count == 0:
            for card_data in INITIAL_CARDS:
                session.add(Card(**card_data))
                logger.info(f"Seeded card: {card_data['card_name']}")

        await session.commit()
