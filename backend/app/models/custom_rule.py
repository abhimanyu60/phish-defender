"""
app/models/custom_rule.py — Analyst-defined force-classification rules.
"""
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class CustomRule(Base):
    """
    A rule that forces the AI classifier to assign a specific category
    when a sender domain or keyword matches.

    Rule types:
      - "domain"  : match email senderDomain exactly
      - "keyword" : match any keyword found in subject or body

    Force categories:
      - "high_malicious"
      - "low_malicious"
      - "safe"
    """
    __tablename__ = "custom_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # "domain" | "keyword"
    rule_type = Column(String(16), nullable=False, index=True)

    # The domain name or keyword phrase to match (case-insensitive)
    value = Column(String(512), nullable=False)

    # Category to force when this rule fires
    force_category = Column(String(32), nullable=False)

    # Whether the rule is currently active
    is_active = Column(Boolean, nullable=False, default=True)

    # Who created it
    created_by = Column(String(256), nullable=True)

    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
