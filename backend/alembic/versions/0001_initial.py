"""Initial schema — all tables.

Revision ID: 0001
Revises:
Create Date: 2026-02-28
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── emails ────────────────────────────────────────────────────────────
    op.create_table(
        "emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("graph_message_id", sa.String(512), nullable=True),
        sa.Column("mailbox_address", sa.String(256), nullable=False),
        sa.Column("sender", sa.String(512), nullable=False),
        sa.Column("sender_domain", sa.String(256), nullable=False),
        sa.Column("recipient", sa.String(512), nullable=False),
        sa.Column("subject", sa.Text, nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("body_html", sa.Text, nullable=True),
        sa.Column("body_text", sa.Text, nullable=True),
        sa.Column("ai_category", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("confidence_score", sa.Float, nullable=True),
        sa.Column("ai_reasoning", postgresql.ARRAY(sa.Text), nullable=True),
        sa.Column("review_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("analyst_category", sa.String(32), nullable=True),
        sa.Column("analyst_override_reason", sa.Text, nullable=True),
        sa.Column("reviewed_by", sa.String(256), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("similar_email_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_emails_graph_message_id", "emails", ["graph_message_id"], unique=True)
    op.create_index("ix_emails_mailbox_address", "emails", ["mailbox_address"])
    op.create_index("ix_emails_sender_domain", "emails", ["sender_domain"])
    op.create_index("ix_emails_received_at", "emails", ["received_at"])

    # ── threat_indicators ─────────────────────────────────────────────────
    op.create_table(
        "threat_indicators",
        sa.Column("id", sa.Integer, autoincrement=True, nullable=False),
        sa.Column("email_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("indicator_type", sa.String(16), nullable=False),
        sa.Column("value", sa.Text, nullable=False),
        sa.Column("is_malicious", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["email_id"], ["emails.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_threat_indicators_email_id", "threat_indicators", ["email_id"])

    # ── email_audit_trail ─────────────────────────────────────────────────
    op.create_table(
        "email_audit_trail",
        sa.Column("id", sa.Integer, autoincrement=True, nullable=False),
        sa.Column("email_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("actor", sa.String(256), nullable=False),
        sa.Column("detail", sa.Text, nullable=True),
        sa.ForeignKeyConstraint(["email_id"], ["emails.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_audit_trail_email_id", "email_audit_trail", ["email_id"])

    # ── audit_log ─────────────────────────────────────────────────────────
    op.create_table(
        "audit_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("analyst", sa.String(256), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("email_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("detail", sa.Text, nullable=True),
        sa.Column("previous_category", sa.String(32), nullable=True),
        sa.Column("new_category", sa.String(32), nullable=True),
        sa.ForeignKeyConstraint(["email_id"], ["emails.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_log_timestamp", "audit_log", ["timestamp"])
    op.create_index("ix_audit_log_analyst", "audit_log", ["analyst"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_email_id", "audit_log", ["email_id"])

    # ── app_settings ──────────────────────────────────────────────────────
    op.create_table(
        "app_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("job_status", sa.String(16), nullable=False, server_default="idle"),
        sa.Column("job_last_run", sa.DateTime(timezone=True), nullable=True),
        sa.Column("job_error_message", sa.String(512), nullable=True),
        sa.Column("high_malicious_threshold", sa.Float, nullable=False, server_default="0.8"),
        sa.Column("low_malicious_threshold", sa.Float, nullable=False, server_default="0.5"),
        sa.Column("notify_high_malicious_spike", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("notify_job_failure", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("notify_daily_digest", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── mailboxes ─────────────────────────────────────────────────────────
    op.create_table(
        "mailboxes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("address", sa.String(256), nullable=False),
        sa.Column("display_name", sa.String(256), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(512), nullable=True),
        sa.Column("delta_link", sa.String(2048), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("address"),
    )
    op.create_index("ix_mailboxes_address", "mailboxes", ["address"], unique=True)

    # ── custom_rules ──────────────────────────────────────────────────────
    op.create_table(
        "custom_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_type", sa.String(16), nullable=False),
        sa.Column("value", sa.String(512), nullable=False),
        sa.Column("force_category", sa.String(32), nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.String(256), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_custom_rules_rule_type", "custom_rules", ["rule_type"])


def downgrade() -> None:
    op.drop_table("custom_rules")
    op.drop_table("mailboxes")
    op.drop_table("app_settings")
    op.drop_table("audit_log")
    op.drop_table("email_audit_trail")
    op.drop_table("threat_indicators")
    op.drop_table("emails")
