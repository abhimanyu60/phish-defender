"""
app/routers/settings.py — Application settings, custom rules, mailboxes, and job control.

GET    /api/settings                          — Fetch full settings
PATCH  /api/settings/thresholds              — Update AI thresholds
PATCH  /api/settings/notifications           — Update notification prefs
POST   /api/settings/job/pause               — Pause ingestion job
POST   /api/settings/job/resume              — Resume ingestion job
POST   /api/settings/job/trigger             — Manually trigger ingestion
GET    /api/settings/rules                   — List custom rules
POST   /api/settings/rules                   — Create custom rule
DELETE /api/settings/rules/{rule_id}         — Delete custom rule
GET    /api/settings/mailboxes               — List mailboxes
"""
from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.custom_rule import CustomRule
from app.models.mailbox import Mailbox
from app.models.settings import AppSettings
from app.schemas.settings import (
    CustomRuleCreate,
    CustomRuleOut,
    MailboxOut,
    SettingsOut,
    SettingsUpdateNotifications,
    SettingsUpdateThresholds,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])


# ── Helper: get or create the singleton settings row ──────────────────────────

async def _get_settings(db: AsyncSession) -> AppSettings:
    result = await db.execute(select(AppSettings).limit(1))
    row = result.scalar_one_or_none()
    if row is None:
        row = AppSettings()
        db.add(row)
        await db.flush()
    return row


# ── Full settings GET ──────────────────────────────────────────────────────────

@router.get("", response_model=SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)) -> SettingsOut:
    row = await _get_settings(db)

    rules_result = await db.execute(select(CustomRule).order_by(CustomRule.created_at))
    rules = list(rules_result.scalars().all())

    mb_result = await db.execute(select(Mailbox).order_by(Mailbox.created_at))
    mailboxes = list(mb_result.scalars().all())

    return SettingsOut(
        **{c.name: getattr(row, c.name) for c in AppSettings.__table__.columns},
        custom_rules=[CustomRuleOut.model_validate(r) for r in rules],
        mailboxes=[MailboxOut.model_validate(m) for m in mailboxes],
    )


# ── Threshold update ───────────────────────────────────────────────────────────

@router.patch("/thresholds", response_model=SettingsOut)
async def update_thresholds(
    body: SettingsUpdateThresholds,
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    if body.low_malicious_threshold >= body.high_malicious_threshold:
        raise HTTPException(
            status_code=422,
            detail="low_malicious_threshold must be less than high_malicious_threshold",
        )
    row = await _get_settings(db)
    row.high_malicious_threshold = body.high_malicious_threshold
    row.low_malicious_threshold = body.low_malicious_threshold
    db.add(row)
    return await get_settings(db)


# ── Notifications update ───────────────────────────────────────────────────────

@router.patch("/notifications", response_model=SettingsOut)
async def update_notifications(
    body: SettingsUpdateNotifications,
    db: AsyncSession = Depends(get_db),
) -> SettingsOut:
    row = await _get_settings(db)
    if body.notify_high_malicious_spike is not None:
        row.notify_high_malicious_spike = body.notify_high_malicious_spike
    if body.notify_job_failure is not None:
        row.notify_job_failure = body.notify_job_failure
    if body.notify_daily_digest is not None:
        row.notify_daily_digest = body.notify_daily_digest
    db.add(row)
    return await get_settings(db)


# ── Job controls ───────────────────────────────────────────────────────────────

@router.post("/job/pause")
async def pause_job(db: AsyncSession = Depends(get_db)) -> dict:
    row = await _get_settings(db)
    row.job_status = "paused"
    db.add(row)
    return {"success": True, "job_status": "paused"}


@router.post("/job/resume")
async def resume_job(db: AsyncSession = Depends(get_db)) -> dict:
    row = await _get_settings(db)
    row.job_status = "idle"
    db.add(row)
    return {"success": True, "job_status": "idle"}


@router.post("/job/trigger")
async def trigger_job(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Manually kick off an ingestion run in the background."""
    from app.services.ingestion import run_ingestion  # deferred to avoid circular
    background_tasks.add_task(run_ingestion)
    return {"success": True, "message": "Ingestion job triggered"}


# ── Custom rules CRUD ──────────────────────────────────────────────────────────

@router.get("/rules", response_model=List[CustomRuleOut])
async def list_rules(db: AsyncSession = Depends(get_db)) -> List[CustomRuleOut]:
    result = await db.execute(select(CustomRule).order_by(CustomRule.created_at))
    return [CustomRuleOut.model_validate(r) for r in result.scalars().all()]


@router.post("/rules", response_model=CustomRuleOut, status_code=201)
async def create_rule(
    body: CustomRuleCreate,
    db: AsyncSession = Depends(get_db),
) -> CustomRuleOut:
    rule = CustomRule(
        rule_type=body.rule_type,
        value=body.value,
        force_category=body.force_category,
        created_by=body.created_by,
    )
    db.add(rule)
    await db.flush()
    return CustomRuleOut.model_validate(rule)


@router.delete("/rules/{rule_id}", status_code=204)
async def delete_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(select(CustomRule).where(CustomRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)


# ── Mailboxes (read-only from API; managed via .env or DB seeding) ─────────────

@router.get("/mailboxes", response_model=List[MailboxOut])
async def list_mailboxes(db: AsyncSession = Depends(get_db)) -> List[MailboxOut]:
    result = await db.execute(select(Mailbox).order_by(Mailbox.created_at))
    return [MailboxOut.model_validate(m) for m in result.scalars().all()]
