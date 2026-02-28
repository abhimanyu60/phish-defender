"""
app/schemas/audit_log.py — Pydantic schemas for the global audit log.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    timestamp: datetime
    analyst: str
    action: str
    email_id: Optional[uuid.UUID] = None
    detail: Optional[str] = None
    previous_category: Optional[str] = None
    new_category: Optional[str] = None


class AuditLogResponse(BaseModel):
    entries: List[AuditLogEntry]
    total: int
    page: int
    page_size: int
    total_pages: int
