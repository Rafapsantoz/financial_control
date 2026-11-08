import logging
from sqlalchemy import select, text
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
]

INITIAL_CARDS = [
    {"card_name": "Nubank", "total_limit": 5000.0, "payment_date": None, "due_day": 10},
]

INITIAL_GOALS = [
    {"title": "Cortina", "target_amount": 150.0, "saved_amount": 150.0, "category": "Essencial", "priority": "Média", "is_completed": True, "comment": "Cortina da sala"},
    {"title": "Mesa", "target_amount": 350.0, "saved_amount": 350.0, "category": "Essencial", "priority": "Alta", "is_completed": True, "comment": "Mesa de trabalho home office"},
    {"title": "Robô aspirador", "target_amount": 800.0, "saved_amount": 400.0, "category": "Conforto", "priority": "Média", "is_completed": False, "comment": "Robô aspirador para limpeza diária"},
    {"title": "Cadeira Ergonômica", "target_amount": 900.0, "saved_amount": 0.0, "category": "Conforto", "priority": "Média", "is_completed": False, "comment": "Saúde postural no trabalho"},
    {"title": "Monitor Secundário", "target_amount": 750.0, "saved_amount": 0.0, "category": "Essencial", "priority": "Alta", "is_completed": False, "comment": "Produtividade no código"},
    {"title": "Headset", "target_amount": 250.0, "saved_amount": 0.0, "category": "Essencial", "priority": "Baixa", "is_completed": False, "comment": "Reuniões e calls"},
    {"title": "Tela para Janela", "target_amount": 180.0, "saved_amount": 0.0, "category": "Essencial", "priority": "Média", "is_completed": False, "comment": "Proteção para cachorros"},
]


async def init_db() -> None:
    """
    Initializes database tables and seeds standard records idempotently.
    Enforces SQLite foreign keys, WAL mode, and automatic schema migrations.
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

        # Seed Goals
        for goal_data in INITIAL_GOALS:
            stmt = select(Goal).where(Goal.title == goal_data["title"])
            existing = await session.scalar(stmt)
            if not existing:
                session.add(Goal(**goal_data))
                logger.info(f"Seeded goal: {goal_data['title']}")

        await session.commit()
