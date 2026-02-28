"""
app/services/openai_classifier.py — Azure OpenAI-powered email classifier.

STATUS: Scaffolded but NOT active by default.
        The ingestion pipeline uses SimpleClassifier (heuristic) by default.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOW TO ACTIVATE

1.  Install the openai package (already in requirements.txt):
        pip install openai==1.54.4

2.  Add credentials to backend/.env:
        AZURE_OPENAI_ENDPOINT=https://<resource>.openai.azure.com/
        AZURE_OPENAI_API_KEY=<your-api-key>
        AZURE_OPENAI_DEPLOYMENT=gpt-4o          # your deployment name
        AZURE_OPENAI_API_VERSION=2024-02-01

3.  In backend/app/services/ingestion.py, replace the classifier
    instantiation block (look for "CLASSIFIER SELECTION") with:

        from app.services.openai_classifier import OpenAIClassifier
        from app.services.openai_classifier import SimpleClassifier  # fallback

        _settings = get_settings()
        if _settings.openai_configured:
            _classifier = OpenAIClassifier()
        else:
            _classifier = SimpleClassifier()

    Both classes expose the same async-compatible interface, so the rest
    of ingestion.py requires no other changes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
from __future__ import annotations

import json
import logging
from typing import List, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a cybersecurity expert specializing in email phishing detection.
Analyze the provided email and classify it into one of three categories:

  • high_malicious  — clear phishing or malware delivery attempt
  • low_malicious   — suspicious, possibly spam or social engineering
  • safe            — legitimate email

Respond with valid JSON only. No prose, no markdown, no code fences.
Schema:
{
  "category": "high_malicious" | "low_malicious" | "safe",
  "confidence": <float 0.0–1.0>,
  "reasoning": [<string>, ...]   // 1-5 concise bullet points explaining the decision
}
"""

_USER_PROMPT_TEMPLATE = """\
SENDER DOMAIN: {sender_domain}
SUBJECT: {subject}

BODY (plain text, truncated to 2000 chars):
{body_text}

URLS FOUND ({url_count}):
{url_sample}
"""


# ---------------------------------------------------------------------------
# OpenAI classifier
# ---------------------------------------------------------------------------

class OpenAIClassifier:
    """
    Classifies emails using Azure OpenAI (GPT-4o or compatible model).

    Exposes the same interface as SimpleClassifier so it can be swapped in
    ingestion.py without any other changes:

        category, confidence, reasoning = classifier.classify(
            subject, body_text, sender_domain, urls, ips,
            high_threshold, low_threshold,
        )

    NOTE: This class is NOT instantiated by default. See module docstring
    for activation instructions.
    """

    def __init__(self) -> None:
        # Import deferred so the app starts fine without the openai package
        # if the classifier is never instantiated.
        try:
            from openai import AsyncAzureOpenAI  # type: ignore[import]
        except ImportError as exc:
            raise ImportError(
                "The 'openai' package is required for OpenAIClassifier. "
                "Run: pip install openai==1.54.4"
            ) from exc

        from app.config import get_settings
        cfg = get_settings()

        if not cfg.openai_configured:
            raise ValueError(
                "Azure OpenAI credentials are not fully configured. "
                "Set AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, and "
                "AZURE_OPENAI_DEPLOYMENT in backend/.env"
            )

        self._client = AsyncAzureOpenAI(
            azure_endpoint=cfg.azure_openai_endpoint,
            api_key=cfg.azure_openai_api_key,
            api_version=cfg.azure_openai_api_version,
        )
        self._deployment = cfg.azure_openai_deployment
        logger.info(
            "OpenAIClassifier initialised (deployment: %s)", self._deployment
        )

    async def _call_api(self, subject: str, body_text: str, sender_domain: str, urls: List[str]) -> dict:
        """Send the classification request to Azure OpenAI and parse the JSON response."""
        url_sample = "\n".join(urls[:10]) if urls else "(none)"
        user_message = _USER_PROMPT_TEMPLATE.format(
            sender_domain=sender_domain,
            subject=subject,
            body_text=(body_text or "")[:2000],
            url_count=len(urls),
            url_sample=url_sample,
        )

        response = await self._client.chat.completions.create(
            model=self._deployment,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.0,       # deterministic output
            max_tokens=512,
            response_format={"type": "json_object"},
        )

        raw = response.choices[0].message.content or "{}"
        return json.loads(raw)

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
        """
        Synchronous wrapper — raises RuntimeError because this classifier is async.

        ingestion.py calls classify() synchronously; if you switch to
        OpenAIClassifier you should also make _process_message() await an
        async classify() method. The async version is classify_async() below.

        For a quick drop-in, wrap calls with asyncio.run() or use classify_async()
        inside an async context.
        """
        raise RuntimeError(
            "OpenAIClassifier.classify() is async. "
            "Call await classifier.classify_async(...) instead and update "
            "_process_message() in ingestion.py accordingly."
        )

    async def classify_async(
        self,
        subject: str,
        body_text: str,
        sender_domain: str,
        urls: List[str],
        ips: List[str],
        high_threshold: float,
        low_threshold: float,
    ) -> Tuple[str, float, List[str]]:
        """
        Classify an email using Azure OpenAI.

        Returns (category, confidence, reasoning_bullets) — same shape as
        SimpleClassifier.classify().

        Falls back to heuristic scoring if the API call fails, so ingestion
        is never blocked by a transient OpenAI error.
        """
        try:
            result = await self._call_api(subject, body_text, sender_domain, urls)

            category: str = result.get("category", "safe")
            confidence: float = float(result.get("confidence", 0.5))
            reasoning: List[str] = result.get("reasoning", [])

            # Validate category value
            if category not in ("high_malicious", "low_malicious", "safe"):
                logger.warning(
                    "OpenAI returned unexpected category '%s', defaulting to 'safe'",
                    category,
                )
                category = "safe"

            # Clamp confidence
            confidence = max(0.0, min(0.99, confidence))

            # Ensure reasoning is a list of strings
            if not isinstance(reasoning, list):
                reasoning = [str(reasoning)]

            logger.debug(
                "OpenAI classified '%s' as %s (%.2f)", subject, category, confidence
            )
            return category, round(confidence, 4), reasoning

        except Exception as exc:
            logger.error(
                "OpenAI classification failed for subject '%s': %s — falling back to heuristics",
                subject,
                exc,
                exc_info=True,
            )
            # Graceful fallback to simple heuristic classifier
            from app.services.ingestion import SimpleClassifier
            fallback = SimpleClassifier()
            return fallback.classify(
                subject=subject,
                body_text=body_text,
                sender_domain=sender_domain,
                urls=urls,
                ips=ips,
                high_threshold=high_threshold,
                low_threshold=low_threshold,
            )
