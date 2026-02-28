"""
app/routers/emails.py — Email queue CRUD, override, and bulk review endpoints.

GET    /api/emails              — Paginated list with filters
GET    /api/emails/{id}         — Full email detail
POST   /api/emails/{id}/override — Analyst override
POST   /api/emails/bulk-review  — Mark multiple emails as reviewed
GET    /api/emails/export       — CSV export (streaming)
"""
from __future__ import annotations

import csv
import io
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.audit_log import AuditLog
from app.models.email import AuditTrailEntry, Email
from app.schemas.email import (
    BulkReviewRequest,
    EmailDetail,
    EmailListItem,
    EmailListResponse,
    OverrideRequest,
)

router = APIRouter(prefix="/api/emails", tags=["emails"])


# ── List / search ──────────────────────────────────────────────────────────────

@router.get("", response_model=EmailListResponse)
async def list_emails(
    category: Optional[str] = Query(None, description="Filter by ai_category"),
    status: Optional[str] = Query(None, description="Filter by review_status"),
    search: Optional[str] = Query(None, description="Search sender/subject"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> EmailListResponse:
    query = select(Email)

    if category:
        query = query.where(Email.ai_category == category)
    if status:
        query = query.where(Email.review_status == status)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                Email.sender.ilike(pattern),
                Email.subject.ilike(pattern),
                Email.sender_domain.ilike(pattern),
            )
        )

    # Count total
    count_result = await db.execute(
        select(Email.id).where(
            *([query.whereclause] if query.whereclause is not None else [])
        )
    )
    # Simpler total count approach
    from sqlalchemy import func
    count_query = select(func.count(Email.id))
    if category:
        count_query = count_query.where(Email.ai_category == category)
    if status:
        count_query = count_query.where(Email.review_status == status)
    if search:
        pattern = f"%{search}%"
        count_query = count_query.where(
            or_(
                Email.sender.ilike(pattern),
                Email.subject.ilike(pattern),
                Email.sender_domain.ilike(pattern),
            )
        )
    total_result = await db.execute(count_query)
    total: int = total_result.scalar_one()

    # Paginated fetch
    offset = (page - 1) * page_size
    query = (
        query.order_by(Email.received_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    emails_result = await db.execute(query)
    emails = emails_result.scalars().all()

    import math
    return EmailListResponse(
        emails=[EmailListItem.model_validate(e) for e in emails],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


# ── Single email detail ────────────────────────────────────────────────────────

@router.get("/{email_id}", response_model=EmailDetail)
async def get_email(
    email_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> EmailDetail:
    result = await db.execute(
        select(Email)
        .options(
            selectinload(Email.threat_indicators),
            selectinload(Email.audit_trail),
        )
        .where(Email.id == email_id)
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    return EmailDetail.model_validate(email)


# ── Analyst override ───────────────────────────────────────────────────────────

@router.post("/{email_id}/override", response_model=EmailDetail)
async def override_email(
    email_id: uuid.UUID,
    body: OverrideRequest,
    db: AsyncSession = Depends(get_db),
) -> EmailDetail:
    result = await db.execute(
        select(Email)
        .options(
            selectinload(Email.threat_indicators),
            selectinload(Email.audit_trail),
        )
        .where(Email.id == email_id)
    )
    email = result.scalar_one_or_none()
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")

    previous_category = email.ai_category

    # Update the email record
    email.analyst_category = body.new_category
    email.analyst_override_reason = body.reason
    email.reviewed_by = body.analyst
    email.reviewed_at = datetime.now(timezone.utc)
    email.review_status = "overridden"
    db.add(email)

    # Append to per-email audit trail
    db.add(
        AuditTrailEntry(
            email_id=email.id,
            timestamp=datetime.now(timezone.utc),
            action="override",
            actor=body.analyst,
            detail=f"Reclassified {previous_category} → {body.new_category}. Reason: {body.reason}",
        )
    )

    # Add to global audit log
    db.add(
        AuditLog(
            analyst=body.analyst,
            action="override",
            email_id=email.id,
            detail=body.reason,
            previous_category=previous_category,
            new_category=body.new_category,
        )
    )

    await db.flush()
    await db.refresh(email)
    return EmailDetail.model_validate(email)


# ── Bulk review ────────────────────────────────────────────────────────────────

@router.post("/bulk-review")
async def bulk_review(
    body: BulkReviewRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Email).where(Email.id.in_(body.email_ids))
    )
    emails = list(result.scalars().all())
    now = datetime.now(timezone.utc)

    updated = 0
    for email in emails:
        if email.review_status == "pending":
            email.review_status = "reviewed"
            email.reviewed_by = body.analyst
            email.reviewed_at = now
            db.add(email)

            db.add(
                AuditTrailEntry(
                    email_id=email.id,
                    timestamp=now,
                    action="reviewed",
                    actor=body.analyst,
                    detail="Marked as reviewed (bulk action)",
                )
            )
            db.add(
                AuditLog(
                    analyst=body.analyst,
                    action="reviewed",
                    email_id=email.id,
                    detail="Bulk review",
                )
            )
            updated += 1

    return {"updated": updated}


# ── CSV export ─────────────────────────────────────────────────────────────────

@router.get("/export/csv")
async def export_emails(
    category: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    analyst: Optional[str] = Query(None, description="Analyst name for audit log"),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    query = select(Email).order_by(Email.received_at.desc())
    if category:
        query = query.where(Email.ai_category == category)
    if status:
        query = query.where(Email.review_status == status)

    result = await db.execute(query)
    emails = list(result.scalars().all())

    # Build CSV in-memory
    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id", "sender", "sender_domain", "recipient", "subject",
            "received_at", "ai_category", "confidence_score",
            "review_status", "analyst_category", "reviewed_by", "reviewed_at",
        ],
    )
    writer.writeheader()
    for e in emails:
        writer.writerow(
            {
                "id": str(e.id),
                "sender": e.sender,
                "sender_domain": e.sender_domain,
                "recipient": e.recipient,
                "subject": e.subject,
                "received_at": e.received_at.isoformat(),
                "ai_category": e.ai_category,
                "confidence_score": e.confidence_score,
                "review_status": e.review_status,
                "analyst_category": e.analyst_category or "",
                "reviewed_by": e.reviewed_by or "",
                "reviewed_at": e.reviewed_at.isoformat() if e.reviewed_at else "",
            }
        )

    # Audit log the export
    if analyst:
        db.add(
            AuditLog(
                analyst=analyst,
                action="export",
                detail=f"Exported {len(emails)} emails to CSV",
            )
        )
        await db.commit()

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=phishdefender_emails.csv"},
    )
