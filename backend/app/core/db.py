from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

_engine = None
_async_session_factory: async_sessionmaker[AsyncSession] | None = None


def init_db(dsn_async: str) -> None:
    global _engine, _async_session_factory
    _engine = create_async_engine(
        dsn_async,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
    )
    _async_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


async def close_db() -> None:
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    assert _async_session_factory is not None, "Database not initialized"
    async with _async_session_factory() as session:
        yield session


async def check_database_ready() -> tuple[bool, str | None]:
    if _engine is None:
        return False, "database engine not initialized"
    try:
        async with _engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True, None
    except SQLAlchemyError as exc:
        return False, str(exc)
