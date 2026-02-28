"""
app/database.py — Async SQLAlchemy engine, session factory, and base model.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# ── Async engine ───────────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=not settings.is_production,   # SQL logging in dev
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# ── Session factory ────────────────────────────────────────────────────────────
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base model ─────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """All ORM models inherit from this base."""
    pass


# ── FastAPI dependency ─────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:
    """
    Yields an async database session per request.
    Usage in a router:
        async def endpoint(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
