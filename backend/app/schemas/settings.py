"""
app/schemas/settings.py — Pydantic schemas for settings, custom rules, and mailboxes.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Custom Rules ───────────────────────────────────────────────────────────────

class CustomRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    rule_type: str           # "domain" | "keyword"
    value: str
    force_category: str      # "high_malicious" | "low_malicious" | "safe"
    is_active: bool
    created_by: Optional[str] = None
    created_at: datetime


class CustomRuleCreate(BaseModel):
    rule_type: str = Field(..., pattern="^(domain|keyword)$")
    value: str = Field(..., min_length=1, max_length=512)
    force_category: str = Field(
        ..., pattern="^(high_malicious|low_malicious|safe)$"
    )
    created_by: Optional[str] = None


# ── Mailbox ────────────────────────────────────────────────────────────────────

class MailboxOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    address: str
    display_name: str
    is_active: bool
    last_polled_at: Optional[datetime] = None
    last_error: Optional[str] = None


# ── Application Settings ───────────────────────────────────────────────────────

class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    job_status: str
    job_last_run: Optional[datetime] = None
    job_error_message: Optional[str] = None
    high_malicious_threshold: float
    low_malicious_threshold: float
    notify_high_malicious_spike: bool
    notify_job_failure: bool
    notify_daily_digest: bool
    updated_at: datetime
    custom_rules: List[CustomRuleOut] = []
    mailboxes: List[MailboxOut] = []


class SettingsUpdateThresholds(BaseModel):
    high_malicious_threshold: float = Field(..., ge=0.0, le=1.0)
    low_malicious_threshold: float = Field(..., ge=0.0, le=1.0)


class SettingsUpdateNotifications(BaseModel):
    notify_high_malicious_spike: Optional[bool] = None
    notify_job_failure: Optional[bool] = None
    notify_daily_digest: Optional[bool] = None
