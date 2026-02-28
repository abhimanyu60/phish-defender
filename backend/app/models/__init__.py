"""app/models/__init__.py — Re-export all models so Alembic autogenerate finds them."""
from app.models.email import Email, ThreatIndicator, AuditTrailEntry  # noqa: F401
from app.models.audit_log import AuditLog  # noqa: F401
from app.models.settings import AppSettings  # noqa: F401
from app.models.mailbox import Mailbox  # noqa: F401
from app.models.custom_rule import CustomRule  # noqa: F401
