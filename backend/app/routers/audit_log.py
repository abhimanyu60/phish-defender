"""
app/routers/audit_log.py — Global analyst audit log endpoints.

GET  /api/audit-log        — Paginated, filtered audit log
GET  /api/audit-log/export — CSV export of the audit log
"""
from __future__ import annotations

import csv
import io
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogEntry, AuditLogResponse

router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])


@router.get("", response_model=AuditLogResponse)
async def list_audit_log(
    analyst: Optional[str] = Query(None, description="Filter by analyst name"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AuditLogResponse:
    base = select(AuditLog)
    count_base = select(func.count(AuditLog.id))

    if analyst:
        base = base.where(AuditLog.analyst.ilike(f"%{analyst}%"))
        count_base = count_base.where(AuditLog.analyst.ilike(f"%{analyst}%"))
    if action:
        base = base.where(AuditLog.action == action)
        count_base = count_base.where(AuditLog.action == action)

    total_result = await db.execute(count_base)
    total: int = total_result.scalar_one()

    offset = (page - 1) * page_size
    rows_result = await db.execute(
        base.order_by(AuditLog.timestamp.desc()).offset(offset).limit(page_size)
    )
    entries = rows_result.scalars().all()

    return AuditLogResponse(
        entries=[AuditLogEntry.model_validate(e) for e in entries],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/export/csv")
async def export_audit_log(
    analyst: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    query = select(AuditLog).order_by(AuditLog.timestamp.desc())
    if analyst:
        query = query.where(AuditLog.analyst.ilike(f"%{analyst}%"))
    if action:
        query = query.where(AuditLog.action == action)

    result = await db.execute(query)
    entries = result.scalars().all()

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=[
            "id", "timestamp", "analyst", "action",
            "email_id", "detail", "previous_category", "new_category",
        ],
    )
    writer.writeheader()
    for e in entries:
        writer.writerow(
            {
                "id": str(e.id),
                "timestamp": e.timestamp.isoformat(),
                "analyst": e.analyst,
                "action": e.action,
                "email_id": str(e.email_id) if e.email_id else "",
                "detail": e.detail or "",
                "previous_category": e.previous_category or "",
                "new_category": e.new_category or "",
            }
        )

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=phishdefender_audit_log.csv"
        },
    )
