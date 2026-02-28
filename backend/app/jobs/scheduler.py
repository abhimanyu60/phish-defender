"""
app/jobs/scheduler.py — APScheduler background polling job.

The scheduler is started during the FastAPI lifespan and runs
`run_ingestion()` every INGESTION_POLL_INTERVAL seconds.

Job is skipped when:
  - AppSettings.job_status == "paused"
  - Graph API credentials are not configured
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.config import get_settings

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _ingestion_job() -> None:
    """Wrapper called by APScheduler — guards against paused state."""
    from app.database import AsyncSessionLocal  # deferred import
    from app.models.settings import AppSettings
    from sqlalchemy import select

    settings_cfg = get_settings()

    if not settings_cfg.graph_api_configured:
        logger.debug("Ingestion job skipped — Graph API not configured")
        return

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(AppSettings).limit(1))
        row = result.scalar_one_or_none()
        if row and row.job_status == "paused":
            logger.debug("Ingestion job skipped — status is paused")
            return

    from app.services.ingestion import run_ingestion  # deferred import

    try:
        summary = await run_ingestion()
        logger.info(
            "Scheduled ingestion complete: %d emails ingested from %d mailboxes",
            summary.get("total_ingested", 0),
            summary.get("mailboxes_processed", 0),
        )
    except Exception as exc:
        logger.error("Scheduled ingestion failed: %s", exc, exc_info=True)


def get_scheduler() -> AsyncIOScheduler:
    """Return the module-level scheduler instance (created on first call)."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="UTC")
    return _scheduler


def start_scheduler() -> None:
    """
    Register the ingestion job and start the scheduler.
    Called once during the FastAPI lifespan startup.
    """
    settings = get_settings()
    scheduler = get_scheduler()

    scheduler.add_job(
        _ingestion_job,
        trigger=IntervalTrigger(seconds=settings.ingestion_poll_interval),
        id="ingestion",
        name="Graph API mailbox ingestion",
        replace_existing=True,
        misfire_grace_time=60,
    )

    scheduler.start()
    logger.info(
        "Ingestion scheduler started — polling every %d seconds",
        settings.ingestion_poll_interval,
    )


def stop_scheduler() -> None:
    """Gracefully shut down the scheduler. Called during FastAPI lifespan shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Ingestion scheduler stopped")
    _scheduler = None
