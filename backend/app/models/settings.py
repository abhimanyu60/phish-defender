"""
app/models/settings.py — Singleton application settings row.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class AppSettings(Base):
    """
    Single-row configuration table.  The app bootstraps a default row on
    first startup; all Settings API calls read/write this row.
    """
    __tablename__ = "app_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Ingestion job
    job_status = Column(String(16), nullable=False, default="idle")
    # "idle" | "running" | "paused" | "error"
    job_last_run = Column(DateTime(timezone=True), nullable=True)
    job_error_message = Column(String(512), nullable=True)

    # AI classification thresholds
    high_malicious_threshold = Column(Float, nullable=False, default=0.80)
    low_malicious_threshold = Column(Float, nullable=False, default=0.50)

    # Notification preferences
    notify_high_malicious_spike = Column(Boolean, nullable=False, default=True)
    notify_job_failure = Column(Boolean, nullable=False, default=True)
    notify_daily_digest = Column(Boolean, nullable=False, default=False)

    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
