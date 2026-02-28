"""
app/services/ingestion.py — Email ingestion pipeline.

Responsibilities:
  1. Poll each active mailbox via the Graph API (delta queries).
  2. De-duplicate against already-ingested graph_message_ids.
  3. Run the AI classifier on each new message.
  4. Apply any active custom rules (force-category overrides).
  5. Extract threat indicators (URLs, domains, IPs) from the message body.
  6. Persist the Email record and its related rows to PostgreSQL.
  7. Update the Mailbox delta_link and last_polled_at.
  8. Write a global AuditLog entry for each ingestion batch.
"""
from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.audit_log import AuditLog
from app.models.custom_rule import CustomRule
from app.models.email import AuditTrailEntry, Email, ThreatIndicator
from app.models.mailbox import Mailbox
from app.models.settings import AppSettings
from app.services.graph_api import GraphAPIClient, get_graph_client

logger = logging.getLogger(__name__)


# ── Regex patterns for threat indicator extraction ─────────────────────────────

_URL_RE = re.compile(
    r"https?://[^\s\"'<>]+",
    re.IGNORECASE,
)
_IP_RE = re.compile(
    r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
)


# ── Simple rule-based AI classifier ───────────────────────────────────────────

class SimpleClassifier:
    """
    Placeholder classifier used until a real ML model is integrated.

    Scoring heuristics:
      - Known phishing keywords in subject/body → raise score
      - Suspicious TLDs (.ru, .xyz, .tk, .cn on non-corporate domains) → raise score
      - Mismatch between display name and domain → raise score
      - URL count → mild raise
      - IP address presence → raise score

    Returns (category, confidence, reasoning_bullets)
    """

    HIGH_KEYWORDS = [
        "verify your account", "urgent action required", "password expired",
        "wire transfer", "confirm your identity", "your account has been suspended",
        "click here immediately", "login to restore", "account verification required",
        "we detected unusual activity",
    ]
    LOW_KEYWORDS = [
        "invoice attached", "delivery failed", "your package", "sign the document",
        "subscription renewal", "limited time offer", "you have been selected",
    ]
    SUSPICIOUS_TLDS = {".ru", ".xyz", ".tk", ".cn", ".top", ".club", ".info"}

    def classify(
        self,
        subject: str,
        body_text: str,
        sender_domain: str,
        urls: List[str],
        ips: List[str],
        high_threshold: float,
        low_threshold: float,
    ) -> Tuple[str, float, List[str]]:
        score = 0.0
        reasoning: List[str] = []
        text = (subject + " " + body_text).lower()

        # High-urgency keyword matches
        matched_high = [kw for kw in self.HIGH_KEYWORDS if kw in text]
        if matched_high:
            score += 0.15 * len(matched_high)
            reasoning.append(
                f"High-risk keywords detected: {', '.join(matched_high[:3])}"
            )

        # Low-urgency keyword matches
        matched_low = [kw for kw in self.LOW_KEYWORDS if kw in text]
        if matched_low and not matched_high:
            score += 0.08 * len(matched_low)
            reasoning.append(
                f"Moderate-risk keywords detected: {', '.join(matched_low[:3])}"
            )

        # Suspicious sender TLD
        domain_lower = sender_domain.lower()
        for tld in self.SUSPICIOUS_TLDS:
            if domain_lower.endswith(tld):
                score += 0.20
                reasoning.append(f"Sender domain uses suspicious TLD: {tld}")
                break

        # Typosquatting heuristic: digits replacing letters in common brands
        brand_patterns = ["paypa1", "amaz0n", "micr0soft", "g00gle", "app1e"]
        for pat in brand_patterns:
            if pat in domain_lower:
                score += 0.25
                reasoning.append(
                    f"Possible typosquatted brand domain detected: {sender_domain}"
                )
                break

        # IP addresses in body (unusual for legitimate email)
        if ips:
            score += 0.10
            reasoning.append(
                f"Raw IP addresses found in message body: {', '.join(ips[:3])}"
            )

        # High URL count
        if len(urls) > 5:
            score += 0.08
            reasoning.append(f"Unusually high number of URLs ({len(urls)}) in body")

        # Cap at 0.99
        score = min(score, 0.99)

        if score >= high_threshold:
            category = "high_malicious"
        elif score >= low_threshold:
            category = "low_malicious"
        else:
            category = "safe"
            if not reasoning:
                reasoning.append("No significant threat indicators detected")

        return category, round(score, 4), reasoning


_classifier = SimpleClassifier()


# ── Indicator extraction ───────────────────────────────────────────────────────

def extract_indicators(
    html: Optional[str], text: Optional[str]
) -> Tuple[List[str], List[str], List[str]]:
    """
    Extract (urls, domains, ips) from email body content.
    """
    content = (html or "") + " " + (text or "")
    urls = list(dict.fromkeys(_URL_RE.findall(content)))  # dedup, preserve order
    ips = list(dict.fromkeys(_IP_RE.findall(content)))

    # Extract domains from found URLs
    domains: List[str] = []
    for url in urls:
        try:
            parsed = urlparse(url)
            if parsed.netloc:
                domains.append(parsed.netloc.lower())
        except Exception:
            pass
    domains = list(dict.fromkeys(domains))

    return urls[:50], domains[:50], ips[:20]  # hard caps


# ── Custom rule matching ───────────────────────────────────────────────────────

def apply_custom_rules(
    subject: str,
    body_text: str,
    sender_domain: str,
    rules: List[CustomRule],
) -> Optional[str]:
    """
    Check active custom rules.  Returns force_category if a rule fires, else None.
    Domain rules are checked first (higher precedence).
    """
    for rule in rules:
        if not rule.is_active:
            continue
        if rule.rule_type == "domain":
            if sender_domain.lower() == rule.value.lower():
                logger.debug("Custom domain rule matched: %s", rule.value)
                return rule.force_category
        elif rule.rule_type == "keyword":
            haystack = (subject + " " + body_text).lower()
            if rule.value.lower() in haystack:
                logger.debug("Custom keyword rule matched: %s", rule.value)
                return rule.force_category
    return None


# ── Main ingestion function ────────────────────────────────────────────────────

async def ingest_mailbox(mailbox: Mailbox, settings_row: AppSettings) -> int:
    """
    Poll one mailbox and persist any new messages.
    Returns the number of new emails ingested.
    """
    ingested = 0

    async with AsyncSessionLocal() as db:
        # Load active custom rules
        rules_result = await db.execute(
            select(CustomRule).where(CustomRule.is_active.is_(True))
        )
        custom_rules: List[CustomRule] = list(rules_result.scalars().all())

        try:
            async with get_graph_client() as graph:
                messages, new_delta = await graph.list_messages(
                    mailbox=mailbox.address,
                    delta_link=mailbox.delta_link,
                )

            for msg in messages:
                try:
                    ingested += await _process_message(
                        db=db,
                        msg=msg,
                        mailbox_address=mailbox.address,
                        custom_rules=custom_rules,
                        high_threshold=settings_row.high_malicious_threshold,
                        low_threshold=settings_row.low_malicious_threshold,
                    )
                except Exception as exc:
                    logger.error(
                        "Failed to process message %s: %s",
                        msg.get("id"),
                        exc,
                        exc_info=True,
                    )

            # Update delta link and poll timestamp
            mailbox.delta_link = new_delta
            mailbox.last_polled_at = datetime.now(timezone.utc)
            mailbox.last_error = None
            db.add(mailbox)

            # Log ingestion batch in audit log
            if ingested > 0:
                db.add(
                    AuditLog(
                        analyst="system",
                        action="ingestion",
                        detail=f"Ingested {ingested} new message(s) from {mailbox.address}",
                    )
                )

            await db.commit()

        except Exception as exc:
            await db.rollback()
            logger.error("Ingestion failed for %s: %s", mailbox.address, exc, exc_info=True)
            mailbox.last_error = str(exc)[:512]
            async with AsyncSessionLocal() as db2:
                db2.add(mailbox)
                await db2.commit()

    return ingested


async def _process_message(
    db: AsyncSession,
    msg: Dict[str, Any],
    mailbox_address: str,
    custom_rules: List[CustomRule],
    high_threshold: float,
    low_threshold: float,
) -> int:
    """
    Process a single Graph message dict.  Returns 1 if persisted, 0 if duplicate.
    """
    graph_id: str = msg.get("id", "")
    if not graph_id:
        return 0

    # De-duplicate
    existing = await db.execute(
        select(Email.id).where(Email.graph_message_id == graph_id)
    )
    if existing.scalar_one_or_none():
        return 0  # already ingested

    from app.services.graph_api import GraphAPIClient  # local import to avoid cycle

    sender, sender_domain = GraphAPIClient.extract_sender(msg)
    recipient = GraphAPIClient.extract_recipient(msg)
    received_at = GraphAPIClient.extract_received_at(msg)
    body_html, body_text = GraphAPIClient.extract_body(msg)
    subject: str = msg.get("subject", "(no subject)")

    # Extract threat indicators
    urls, domains, ips = extract_indicators(body_html, body_text)

    # Classify
    ai_category, confidence, reasoning = _classifier.classify(
        subject=subject,
        body_text=body_text or "",
        sender_domain=sender_domain,
        urls=urls,
        ips=ips,
        high_threshold=high_threshold,
        low_threshold=low_threshold,
    )

    # Apply custom rules (may override AI)
    forced = apply_custom_rules(
        subject=subject,
        body_text=body_text or "",
        sender_domain=sender_domain,
        rules=custom_rules,
    )
    if forced:
        ai_category = forced
        reasoning.insert(0, f"Force-classified by custom rule → {forced}")

    # Build and persist Email
    email = Email(
        graph_message_id=graph_id,
        mailbox_address=mailbox_address,
        sender=sender,
        sender_domain=sender_domain,
        recipient=recipient,
        subject=subject,
        received_at=received_at,
        body_html=body_html,
        body_text=body_text,
        ai_category=ai_category,
        confidence_score=confidence,
        ai_reasoning=reasoning,
        review_status="pending",
    )
    db.add(email)
    await db.flush()  # get email.id without committing

    # Threat indicators
    for url in urls:
        db.add(ThreatIndicator(email_id=email.id, indicator_type="url", value=url))
    for domain in domains:
        db.add(ThreatIndicator(email_id=email.id, indicator_type="domain", value=domain))
    for ip in ips:
        db.add(ThreatIndicator(email_id=email.id, indicator_type="ip", value=ip))

    # Initial audit trail entry
    db.add(
        AuditTrailEntry(
            email_id=email.id,
            timestamp=datetime.now(timezone.utc),
            action="ingested",
            actor="system",
            detail=f"AI classified as {ai_category} (confidence: {confidence:.2%})",
        )
    )

    return 1


# ── Ingestion runner (called by scheduler) ────────────────────────────────────

async def run_ingestion() -> Dict[str, Any]:
    """
    Top-level ingestion runner.  Iterates all active mailboxes.
    Updates job status in AppSettings before and after.

    Returns summary dict.
    """
    summary: Dict[str, Any] = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "mailboxes_processed": 0,
        "total_ingested": 0,
        "errors": [],
    }

    async with AsyncSessionLocal() as db:
        # Set job status to "running"
        settings_result = await db.execute(select(AppSettings))
        settings_row: Optional[AppSettings] = settings_result.scalar_one_or_none()
        if settings_row:
            settings_row.job_status = "running"
            db.add(settings_row)
            await db.commit()

    if not settings_row:
        logger.warning("AppSettings row not found — skipping ingestion")
        return summary

    # Load active mailboxes
    async with AsyncSessionLocal() as db:
        mb_result = await db.execute(
            select(Mailbox).where(Mailbox.is_active.is_(True))
        )
        mailboxes: List[Mailbox] = list(mb_result.scalars().all())

    settings_cfg = get_settings()
    if not settings_cfg.graph_api_configured:
        logger.warning(
            "Graph API credentials not configured — ingestion skipped. "
            "Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in .env"
        )
        async with AsyncSessionLocal() as db:
            s = await db.get(AppSettings, settings_row.id)
            if s:
                s.job_status = "idle"
                await db.commit()
        return summary

    for mailbox in mailboxes:
        try:
            count = await ingest_mailbox(mailbox, settings_row)
            summary["total_ingested"] += count
            summary["mailboxes_processed"] += 1
        except Exception as exc:
            err = f"{mailbox.address}: {exc}"
            logger.error(err, exc_info=True)
            summary["errors"].append(err)

    # Update job status back to idle
    async with AsyncSessionLocal() as db:
        s = await db.get(AppSettings, settings_row.id)
        if s:
            s.job_status = "idle"
            s.job_last_run = datetime.now(timezone.utc)
            if summary["errors"]:
                s.job_error_message = "; ".join(summary["errors"])[:512]
            else:
                s.job_error_message = None
            db.add(s)
            await db.commit()

    logger.info(
        "Ingestion complete: %d emails from %d mailboxes",
        summary["total_ingested"],
        summary["mailboxes_processed"],
    )
    return summary
