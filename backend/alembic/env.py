"""
alembic/env.py — Alembic migration environment.

Reads DATABASE_SYNC_URL from environment so the URL is never hard-coded.
Imports all models via app.models so autogenerate can detect schema changes.
"""
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

# ── Put the backend/ directory on the path ────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ── Import all models so Alembic autogenerate finds them ──────────────────────
import app.models  # noqa: F401 — side-effect: registers all ORM models
from app.database import Base
from app.config import get_settings

# ── Alembic config object ─────────────────────────────────────────────────────
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url from the environment
settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_sync_url)

target_metadata = Base.metadata


# ── Offline migrations ────────────────────────────────────────────────────────
def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations ─────────────────────────────────────────────────────────
def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
