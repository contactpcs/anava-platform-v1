"""Alembic environment — wired to read DATABASE_URL from the environment.

This project uses the Supabase SDK directly (no SQLAlchemy ORM models), so
autogenerate is not configured. Migrations are written as raw SQL inside
upgrade()/downgrade() using op.execute(). To get the PostgreSQL connection
string: Supabase Dashboard → Project Settings → Database → URI (use the
"Session mode" pooler URI for migrations, not the transaction-mode one).

Set the variable before running any alembic command:
    $env:DATABASE_URL = "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
    alembic upgrade head
"""
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# No SQLAlchemy metadata — migrations are hand-written SQL
target_metadata = None


def _db_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set.\n"
            "Get it from: Supabase Dashboard → Project Settings → Database → URI"
        )
    # SQLAlchemy requires postgresql:// not postgres://
    return url.replace("postgres://", "postgresql://", 1)


def run_migrations_offline() -> None:
    """Run migrations without a live DB connection — emits SQL to stdout."""
    context.configure(
        url=_db_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _db_url()

    connectable = engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
