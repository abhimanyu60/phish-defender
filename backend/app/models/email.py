"""
app/models/email.py — Email, per-email threat indicators, and per-email audit trail.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Email(Base):
    """
    Core email record created by the ingestion job when a new message is
    fetched from a shared mailbox via the Graph API.
    """
    __tablename__ = "emails"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Graph API identifiers
    graph_message_id = Column(String(512), unique=True, nullable=True, index=True)
    mailbox_address = Column(String(256), nullable=False, index=True)

    # Envelope fields
    sender = Column(String(512), nullable=False)
    sender_domain = Column(String(256), nullable=False, index=True)
    recipient = Column(String(512), nullable=False)
    subject = Column(Text, nullable=False)
    received_at = Column(DateTime(timezone=True), nullable=False, index=True)

    # Email body (HTML preserved for sandbox rendering)
    body_html = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)

    # AI classification
    ai_category = Column(String(32), nullable=False, default="pending")
    # "high_malicious" | "low_malicious" | "safe" | "pending"
    confidence_score = Column(Float, nullable=True)
    ai_reasoning = Column(ARRAY(Text), nullable=True)

    # Analyst review
    review_status = Column(String(32), nullable=False, default="pending")
    # "pending" | "reviewed" | "overridden"
    analyst_category = Column(String(32), nullable=True)
    analyst_override_reason = Column(Text, nullable=True)
    reviewed_by = Column(String(256), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)

    # Similar email references (stored as array of UUIDs)
    similar_email_ids = Column(ARRAY(UUID(as_uuid=True)), nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    threat_indicators = relationship(
        "ThreatIndicator", back_populates="email", cascade="all, delete-orphan"
    )
    audit_trail = relationship(
        "AuditTrailEntry",
        back_populates="email",
        cascade="all, delete-orphan",
        order_by="AuditTrailEntry.timestamp",
    )


class ThreatIndicator(Base):
    """
    Individual threat indicators extracted from an email
    (URLs, domains, IP addresses).
    """
    __tablename__ = "threat_indicators"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    indicator_type = Column(String(16), nullable=False)
    # "url" | "domain" | "ip"
    value = Column(Text, nullable=False)
    is_malicious = Column(Boolean, default=False, nullable=False)

    email = relationship("Email", back_populates="threat_indicators")


class AuditTrailEntry(Base):
    """
    Per-email audit trail entry (inline timeline shown in EmailDetail).
    Distinct from the global AuditLog — this is embedded in the email record.
    """
    __tablename__ = "email_audit_trail"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(
        UUID(as_uuid=True),
        ForeignKey("emails.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp = Column(DateTime(timezone=True), nullable=False)
    action = Column(String(64), nullable=False)
    actor = Column(String(256), nullable=False)
    detail = Column(Text, nullable=True)

    email = relationship("Email", back_populates="audit_trail")
