from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import AsyncAdaptedQueuePool
from sqlalchemy import text
from app.config import get_settings
import structlog
from typing import AsyncGenerator

logger = structlog.get_logger()


class TSDBBase(DeclarativeBase):
    pass


def _to_async_url(url: str) -> str:
    """Convert postgres:// or postgresql:// → postgresql+asyncpg://, strip sslmode."""
    from urllib.parse import urlparse, urlencode, parse_qs, urlunparse
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+asyncpg://" + url[len(prefix):]
            break
    # asyncpg uses connect_args={"ssl": ...} — sslmode in the DSN is not understood
    if "sslmode" in url:
        parsed = urlparse(url)
        params = {k: v[0] for k, v in parse_qs(parsed.query).items() if k != "sslmode"}
        url = urlunparse(parsed._replace(query=urlencode(params)))
    return url


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_tsdb_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        async_url = _to_async_url(settings.TSDB_DATABASE_URL)
        _engine = create_async_engine(
            async_url,
            poolclass=AsyncAdaptedQueuePool,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True,
            connect_args={"ssl": "require"},
            echo=settings.ENVIRONMENT == "development",
        )
        logger.info("tsdb_engine_created")
    return _engine


def get_tsdb_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_tsdb_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_tsdb_session() -> AsyncGenerator[AsyncSession, None]:
    factory = get_tsdb_session_factory()
    async with factory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def check_tsdb_health() -> bool:
    try:
        engine = get_tsdb_engine()
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error("tsdb_health_check_failed", error=str(e))
        return False
