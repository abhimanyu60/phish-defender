"""
app/schemas/dashboard.py — Pydantic schemas for the dashboard endpoints.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.email import EmailListItem


class TrendDay(BaseModel):
    date: str          # "YYYY-MM-DD"
    high_malicious: int
    low_malicious: int
    safe: int


class IngestionStatus(BaseModel):
    status: str        # "idle" | "running" | "paused" | "error"
    last_run: Optional[datetime] = None
    error_message: Optional[str] = None
    mailboxes_active: int
    mailboxes_total: int


class DashboardSummary(BaseModel):
    total_today: int
    high_malicious_today: int
    low_malicious_today: int
    safe_today: int
    pending_review: int
    trend: List[TrendDay]
    ingestion: IngestionStatus
    recent_high_malicious: List[EmailListItem]
