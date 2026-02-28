"""
app/models/audit_log.py — Global analyst action log (reviewed / override / export).
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class AuditLog(Base):
    """
    Records every significant analyst action across the entire platform.
    The /audit-log page queries this table.
    """
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Who performed the action
    analyst = Column(String(256), nullable=False, index=True)

    # Action type: "reviewed" | "override" | "export" | "settings_change" | "job_trigger"
    action = Column(String(64), nullable=False, index=True)

    # Optional link to the email this action concerns
    email_id = Column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Human-readable detail / notes
    detail = Column(Text, nullable=True)

    # Previous and new values for override actions
    previous_category = Column(String(32), nullable=True)
    new_category = Column(String(32), nullable=True)
