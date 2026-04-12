"""Alembic env.py — async-aware, reads config from app settings."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from app.core.config import get_settings

# Alembic Config object
config = context.config

# 从 app 配置注入 DB URL（覆盖 alembic.ini 中的占位值）
config.set_main_option("sqlalchemy.url", get_settings().db_dsn_async)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 导入所有模型，让 Alembic 能发现元数据
from app.models import Base  # noqa: E402
import app.models.user  # noqa: F401, E402
import app.models.family  # noqa: F401, E402
import app.models.baby  # noqa: F401, E402
import app.models.event  # noqa: F401, E402
import app.models.summary  # noqa: F401, E402
import app.models.analytics  # noqa: F401, E402
import app.models.alert  # noqa: F401, E402
import app.models.ai  # noqa: F401, E402
import app.models.export  # noqa: F401, E402
import app.models.task  # noqa: F401, E402
import app.models.audit  # noqa: F401, E402

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：直接生成 SQL 脚本，不连接数据库。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """在线模式：使用 async engine 执行迁移。"""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
