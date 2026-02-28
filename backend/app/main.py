"""
app/main.py — FastAPI application factory.

Startup sequence:
  1. Create all DB tables if they don't exist (via Alembic-compatible Base.metadata).
  2. Seed the AppSettings singleton row and any mailboxes from .env.
  3. Start the APScheduler background ingestion job.

Shutdown sequence:
  1. Stop the scheduler gracefully.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import AsyncSessionLocal, Base, engine
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.routers import analytics, audit_log, dashboard, emails, settings

logger = logging.getLogger(__name__)
settings_cfg = get_settings()


# ── Startup / shutdown lifespan ────────────────────────────────────────────────

async def _seed_db() -> None:
    """
    Ensure the singleton AppSettings row exists and all mailboxes from .env
    are present in the database.
    """
    from sqlalchemy import select

    from app.models.mailbox import Mailbox
    from app.models.settings import AppSettings

    async with AsyncSessionLocal() as db:
        # AppSettings singleton
        result = await db.execute(select(AppSettings).limit(1))
        if result.scalar_one_or_none() is None:
            db.add(AppSettings())
            logger.info("Created default AppSettings row")

        # Mailboxes from SHARED_MAILBOXES env var
        for address in settings_cfg.mailbox_list:
            mb_result = await db.execute(
                select(Mailbox).where(Mailbox.address == address)
            )
            if mb_result.scalar_one_or_none() is None:
                display = address.split("@")[0].replace("-", " ").replace("_", " ").title()
                db.add(Mailbox(address=address, display_name=display))
                logger.info("Seeded mailbox: %s", address)

        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ────────────────────────────────────────────────────────────
    logger.info("PhishDefender backend starting up…")

    # Create tables (idempotent — does not drop existing data)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await _seed_db()
    start_scheduler()

    yield  # application running

    # ── Shutdown ───────────────────────────────────────────────────────────
    stop_scheduler()
    await engine.dispose()
    logger.info("PhishDefender backend shut down")


# ── Application factory ────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="PhishDefender API",
        description=(
            "Backend for the PhishDefender phishing analysis platform. "
            "Ingests emails from shared mailboxes via the Microsoft Graph API, "
            "classifies them with an AI model, and exposes REST endpoints for "
            "the analyst dashboard."
        ),
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ───────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings_cfg.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────────────────
    app.include_router(dashboard.router)
    app.include_router(emails.router)
    app.include_router(analytics.router)
    app.include_router(audit_log.router)
    app.include_router(settings.router)

    # ── Health check ───────────────────────────────────────────────────────
    @app.get("/api/health", tags=["health"])
    async def health() -> dict:
        return {"status": "ok", "version": "1.0.0"}

    return app


app = create_app()


# ── Dev entrypoint (python -m app.main) ────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings_cfg.app_host,
        port=settings_cfg.app_port,
        reload=not settings_cfg.is_production,
        log_level="debug" if not settings_cfg.is_production else "info",
    )
