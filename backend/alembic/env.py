import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context

# Make app importable
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database_tsdb import TSDBBase, _to_async_url
from app.models.eeg_report_orm import EEGReport  # noqa: F401 — registers table in metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = TSDBBase.metadata


def _get_url() -> str:
    raw = os.environ.get(
        "TSDB_DATABASE_URL",
        "postgres://tsdbadmin@gguyvxc03b.oiyo0zj1k9.tsdb.cloud.timescale.com:35472/tsdb?sslmode=require",
    )
    return _to_async_url(raw)


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    engine = create_async_engine(
        _get_url(),
        connect_args={"ssl": "require"},
    )
    async with engine.connect() as conn:
        await conn.run_sync(
            lambda sync_conn: context.configure(
                connection=sync_conn,
                target_metadata=target_metadata,
                compare_type=True,
            )
        )
        async with conn.begin():
            await conn.run_sync(lambda _: context.run_migrations())

    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
