"""
app/config.py — Central application settings loaded from environment / .env file.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────
    app_env: str = "development"
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    secret_key: str = "change-me"

    # ── Database ───────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://phish_user:phish_pass@localhost:5432/phishdefender"
    )
    database_sync_url: str = (
        "postgresql://phish_user:phish_pass@localhost:5432/phishdefender"
    )

    # ── Azure / Graph API ──────────────────────────────────────────────────
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""

    # ── Shared Mailboxes ───────────────────────────────────────────────────
    shared_mailboxes: str = ""

    @property
    def mailbox_list(self) -> List[str]:
        """Return cleaned list of mailbox addresses."""
        return [m.strip() for m in self.shared_mailboxes.split(",") if m.strip()]

    # ── Ingestion ──────────────────────────────────────────────────────────
    ingestion_poll_interval: int = 300  # seconds

    # ── AI Thresholds ──────────────────────────────────────────────────────
    ai_high_threshold: float = 0.80
    ai_low_threshold: float = 0.50

    # ── CORS ───────────────────────────────────────────────────────────────
    cors_origins: str = "http://localhost:8080,http://localhost:5173"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # ── Azure OpenAI ───────────────────────────────────────────────────────
    # NOTE: The OpenAI classifier is NOT active by default.
    # See backend/app/services/openai_classifier.py for activation instructions.
    azure_openai_endpoint: str = ""       # e.g. https://<resource>.openai.azure.com/
    azure_openai_api_key: str = ""        # API key from Azure OpenAI resource
    azure_openai_deployment: str = ""     # Deployment name, e.g. "gpt-4o"
    azure_openai_api_version: str = "2024-02-01"

    # ── Derived helpers ────────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def graph_api_configured(self) -> bool:
        """True when all three Azure credentials are set."""
        return all([self.azure_tenant_id, self.azure_client_id, self.azure_client_secret])

    @property
    def openai_configured(self) -> bool:
        """True when all Azure OpenAI credentials are set."""
        return all([
            self.azure_openai_endpoint,
            self.azure_openai_api_key,
            self.azure_openai_deployment,
        ])


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — import and call this everywhere."""
    return Settings()
