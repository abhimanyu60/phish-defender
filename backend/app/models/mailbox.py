"""
app/models/mailbox.py — Connected shared mailbox configuration.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Mailbox(Base):
    """
    Each row represents a shared mailbox that the ingestion job should poll
    via the Microsoft Graph API.
    """
    __tablename__ = "mailboxes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # The mailbox UPN / email address used in Graph API calls
    address = Column(String(256), unique=True, nullable=False, index=True)

    # Display name shown in the Settings UI
    display_name = Column(String(256), nullable=False)

    # Whether this mailbox is actively polled
    is_active = Column(Boolean, nullable=False, default=True)

    # When was this mailbox last successfully polled
    last_polled_at = Column(DateTime(timezone=True), nullable=True)

    # Last error encountered during polling (null if last poll was clean)
    last_error = Column(String(512), nullable=True)

    # Graph API delta link (for incremental mail fetching)
    delta_link = Column(String(2048), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
