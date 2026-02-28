"""
app/schemas/email.py — Pydantic request/response schemas for email endpoints.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Threat Indicators ──────────────────────────────────────────────────────────

class ThreatIndicatorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    indicator_type: str  # "url" | "domain" | "ip"
    value: str
    is_malicious: bool


# ── Per-email audit trail ──────────────────────────────────────────────────────

class AuditTrailEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime
    action: str
    actor: str
    detail: Optional[str] = None


# ── Email list item (compact) ──────────────────────────────────────────────────

class EmailListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender: str
    sender_domain: str
    recipient: str
    subject: str
    received_at: datetime
    ai_category: str
    confidence_score: Optional[float] = None
    review_status: str
    mailbox_address: str


# ── Email detail (full) ────────────────────────────────────────────────────────

class EmailDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    graph_message_id: Optional[str] = None
    mailbox_address: str
    sender: str
    sender_domain: str
    recipient: str
    subject: str
    received_at: datetime

    body_html: Optional[str] = None
    body_text: Optional[str] = None

    ai_category: str
    confidence_score: Optional[float] = None
    ai_reasoning: Optional[List[str]] = None

    review_status: str
    analyst_category: Optional[str] = None
    analyst_override_reason: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    similar_email_ids: Optional[List[uuid.UUID]] = None

    threat_indicators: List[ThreatIndicatorOut] = []
    audit_trail: List[AuditTrailEntryOut] = []

    created_at: datetime
    updated_at: datetime


# ── Paginated list response ────────────────────────────────────────────────────

class EmailListResponse(BaseModel):
    emails: List[EmailListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ── Override request ───────────────────────────────────────────────────────────

class OverrideRequest(BaseModel):
    analyst: str = Field(..., min_length=1, max_length=256)
    new_category: str = Field(
        ..., pattern="^(high_malicious|low_malicious|safe)$"
    )
    reason: str = Field(..., min_length=5, max_length=2048)


# ── Bulk review request ────────────────────────────────────────────────────────

class BulkReviewRequest(BaseModel):
    email_ids: List[uuid.UUID] = Field(..., min_length=1)
    analyst: str = Field(..., min_length=1, max_length=256)
