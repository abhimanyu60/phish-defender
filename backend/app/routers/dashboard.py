"""
app/routers/dashboard.py — Dashboard summary endpoint.

GET /api/dashboard/summary
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.email import Email
from app.models.mailbox import Mailbox
from app.models.settings import AppSettings
from app.schemas.dashboard import DashboardSummary, IngestionStatus, TrendDay
from app.schemas.email import EmailListItem

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummary:
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    # ── Today's counts ────────────────────────────────────────────────────
    today_result = await db.execute(
        select(
            func.count(Email.id).label("total"),
            func.count(case((Email.ai_category == "high_malicious", 1))).label("high"),
            func.count(case((Email.ai_category == "low_malicious", 1))).label("low"),
            func.count(case((Email.ai_category == "safe", 1))).label("safe"),
            func.count(case((Email.review_status == "pending", 1))).label("pending"),
        ).where(Email.received_at >= today_start)
    )
    counts = today_result.one()

    # ── 7-day trend ───────────────────────────────────────────────────────
    trend_rows = await db.execute(
        select(
            func.date(Email.received_at).label("date"),
            func.count(case((Email.ai_category == "high_malicious", 1))).label("high"),
            func.count(case((Email.ai_category == "low_malicious", 1))).label("low"),
            func.count(case((Email.ai_category == "safe", 1))).label("safe"),
        )
        .where(Email.received_at >= seven_days_ago)
        .group_by(func.date(Email.received_at))
        .order_by(func.date(Email.received_at))
    )
    trend = [
        TrendDay(
            date=str(r.date),
            high_malicious=r.high,
            low_malicious=r.low,
            safe=r.safe,
        )
        for r in trend_rows
    ]

    # ── Ingestion status ──────────────────────────────────────────────────
    settings_result = await db.execute(select(AppSettings).limit(1))
    settings_row = settings_result.scalar_one_or_none()

    mb_result = await db.execute(select(Mailbox))
    mailboxes = list(mb_result.scalars().all())
    active_mb = sum(1 for m in mailboxes if m.is_active)

    ingestion = IngestionStatus(
        status=settings_row.job_status if settings_row else "idle",
        last_run=settings_row.job_last_run if settings_row else None,
        error_message=settings_row.job_error_message if settings_row else None,
        mailboxes_active=active_mb,
        mailboxes_total=len(mailboxes),
    )

    # ── Recent high malicious ─────────────────────────────────────────────
    recent_result = await db.execute(
        select(Email)
        .where(Email.ai_category == "high_malicious")
        .order_by(Email.received_at.desc())
        .limit(5)
    )
    recent = [EmailListItem.model_validate(e) for e in recent_result.scalars().all()]

    return DashboardSummary(
        total_today=counts.total,
        high_malicious_today=counts.high,
        low_malicious_today=counts.low,
        safe_today=counts.safe,
        pending_review=counts.pending,
        trend=trend,
        ingestion=ingestion,
        recent_high_malicious=recent,
    )
