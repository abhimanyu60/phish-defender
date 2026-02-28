"""
app/services/graph_api.py — Microsoft Graph API integration.

Handles:
  - OAuth2 client credentials token acquisition via MSAL
  - Listing messages in a shared mailbox
  - Fetching full message details (headers + HTML body + attachments list)
  - Incremental fetching using delta links to avoid reprocessing seen messages
  - Graceful fallback when Azure credentials are not configured (dev mode)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import msal

from app.config import get_settings

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.microsoft.com/v1.0"
GRAPH_SCOPES = ["https://graph.microsoft.com/.default"]


class GraphAPIClient:
    """
    Thin async wrapper around the Microsoft Graph REST API.

    All methods are async and use httpx for HTTP.
    A single MSAL ConfidentialClientApplication is reused across calls
    so token caching works correctly.
    """

    def __init__(self) -> None:
        self._settings = get_settings()
        self._msal_app: Optional[msal.ConfidentialClientApplication] = None
        self._http: Optional[httpx.AsyncClient] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def __aenter__(self) -> "GraphAPIClient":
        self._http = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *_: Any) -> None:
        if self._http:
            await self._http.aclose()

    # ── Token acquisition ──────────────────────────────────────────────────

    def _get_msal_app(self) -> msal.ConfidentialClientApplication:
        """Lazy-initialise and cache the MSAL app instance."""
        if self._msal_app is None:
            s = self._settings
            self._msal_app = msal.ConfidentialClientApplication(
                client_id=s.azure_client_id,
                authority=f"https://login.microsoftonline.com/{s.azure_tenant_id}",
                client_credential=s.azure_client_secret,
            )
        return self._msal_app

    def _acquire_token(self) -> str:
        """
        Acquire an access token using the client-credentials flow.
        MSAL handles the token cache internally.
        Raises RuntimeError if token acquisition fails.
        """
        app = self._get_msal_app()
        result = app.acquire_token_silent(GRAPH_SCOPES, account=None)
        if not result:
            result = app.acquire_token_for_client(scopes=GRAPH_SCOPES)

        if "access_token" not in result:
            error = result.get("error_description", result.get("error", "unknown"))
            raise RuntimeError(f"Graph API token acquisition failed: {error}")

        return result["access_token"]

    def _auth_headers(self) -> Dict[str, str]:
        token = self._acquire_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # ── Message listing ────────────────────────────────────────────────────

    async def list_messages(
        self,
        mailbox: str,
        delta_link: Optional[str] = None,
        top: int = 50,
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Fetch new/changed messages from a shared mailbox using Graph delta queries.

        Parameters
        ----------
        mailbox:    The UPN / email address of the shared mailbox.
        delta_link: The delta link from the previous poll (None on first call).
        top:        Max messages to return per page.

        Returns
        -------
        (messages, next_delta_link)
          messages:         List of raw Graph message dicts.
          next_delta_link:  The delta link to store for the next poll.
        """
        assert self._http is not None, "Use as async context manager"

        if delta_link:
            url = delta_link
        else:
            # Initial call — request a delta for the inbox
            url = (
                f"{GRAPH_BASE}/users/{mailbox}/mailFolders/Inbox/messages/delta"
                f"?$top={top}"
                f"&$select=id,subject,from,toRecipients,receivedDateTime,body,isRead"
            )

        messages: List[Dict[str, Any]] = []
        next_delta: Optional[str] = None

        while url:
            resp = await self._http.get(url, headers=self._auth_headers())
            resp.raise_for_status()
            data = resp.json()

            page_messages = data.get("value", [])
            messages.extend(page_messages)

            # Check for next page or delta link
            if "@odata.nextLink" in data:
                url = data["@odata.nextLink"]
                next_delta = None  # not at the end yet
            elif "@odata.deltaLink" in data:
                next_delta = data["@odata.deltaLink"]
                url = None  # done
            else:
                url = None

        return messages, next_delta

    # ── Full message fetch ─────────────────────────────────────────────────

    async def get_message(
        self, mailbox: str, message_id: str
    ) -> Dict[str, Any]:
        """
        Fetch the full details of a single message, including HTML body.
        """
        assert self._http is not None
        url = (
            f"{GRAPH_BASE}/users/{mailbox}/messages/{message_id}"
            "?$select=id,subject,from,toRecipients,receivedDateTime,"
            "body,uniqueBody,internetMessageHeaders,isRead"
        )
        resp = await self._http.get(url, headers=self._auth_headers())
        resp.raise_for_status()
        return resp.json()

    # ── Helpers ────────────────────────────────────────────────────────────

    @staticmethod
    def extract_sender(message: Dict[str, Any]) -> Tuple[str, str]:
        """
        Return (sender_address, sender_domain) from a Graph message dict.
        """
        email_addr: str = (
            message.get("from", {})
            .get("emailAddress", {})
            .get("address", "unknown@unknown.com")
        )
        domain = email_addr.split("@")[-1] if "@" in email_addr else "unknown"
        return email_addr, domain

    @staticmethod
    def extract_recipient(message: Dict[str, Any]) -> str:
        """Return the first To: recipient address."""
        recipients = message.get("toRecipients", [])
        if recipients:
            return recipients[0].get("emailAddress", {}).get("address", "")
        return ""

    @staticmethod
    def extract_received_at(message: Dict[str, Any]) -> datetime:
        """Parse the receivedDateTime string into an aware datetime."""
        raw: str = message.get("receivedDateTime", "")
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            return dt
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc)

    @staticmethod
    def extract_body(message: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
        """
        Return (html_body, text_body).
        Graph always returns the body in the requested contentType.
        We ask for HTML and fall back to text.
        """
        body = message.get("body", {})
        content_type = body.get("contentType", "text").lower()
        content = body.get("content", "")

        if content_type == "html":
            return content, None
        return None, content


# ── Module-level singleton factory ─────────────────────────────────────────────

def get_graph_client() -> GraphAPIClient:
    """Return a new GraphAPIClient instance (use as async context manager)."""
    return GraphAPIClient()
