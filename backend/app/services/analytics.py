"""
app/services/analytics.py — Database-backed analytics aggregation queries.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.email import Email, ThreatIndicator


async def get_category_trend(
    db: AsyncSession, days: int = 30
) -> List[Dict[str, Any]]:
    """Return daily category counts for the past `days` days."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    rows = await db.execute(
        select(
            func.date(Email.received_at).label("date"),
            func.count(case((Email.ai_category == "high_malicious", 1))).label(
                "high_malicious"
            ),
            func.count(case((Email.ai_category == "low_malicious", 1))).label(
                "low_malicious"
            ),
            func.count(case((Email.ai_category == "safe", 1))).label("safe"),
        )
        .where(Email.received_at >= since)
        .group_by(func.date(Email.received_at))
        .order_by(func.date(Email.received_at))
    )

    return [
        {
            "date": str(r.date),
            "high_malicious": r.high_malicious,
            "low_malicious": r.low_malicious,
            "safe": r.safe,
        }
        for r in rows
    ]


async def get_accuracy_stats(db: AsyncSession) -> Dict[str, Any]:
    """Compute AI accuracy metrics from override audit log entries."""
    total_result = await db.execute(
        select(func.count(Email.id)).where(
            Email.review_status.in_(["reviewed", "overridden"])
        )
    )
    total_reviewed: int = total_result.scalar_one() or 0

    override_result = await db.execute(
        select(func.count(Email.id)).where(Email.review_status == "overridden")
    )
    total_overrides: int = override_result.scalar_one() or 0

    agreement_rate = (
        round((total_reviewed - total_overrides) / total_reviewed, 4)
        if total_reviewed > 0
        else 0.0
    )

    # Direction breakdown from AuditLog
    direction_rows = await db.execute(
        select(
            AuditLog.previous_category,
            AuditLog.new_category,
            func.count(AuditLog.id).label("cnt"),
        )
        .where(AuditLog.action == "override")
        .group_by(AuditLog.previous_category, AuditLog.new_category)
    )

    breakdown: Dict[str, int] = {}
    for row in direction_rows:
        if row.previous_category and row.new_category:
            key = f"{row.previous_category}_to_{row.new_category}".replace(
                "high_malicious", "high"
            ).replace("low_malicious", "low")
            breakdown[key] = row.cnt

    return {
        "ai_agreement_rate": agreement_rate,
        "total_reviewed": total_reviewed,
        "total_overrides": total_overrides,
        "high_to_low": breakdown.get("high_to_low", 0),
        "high_to_safe": breakdown.get("high_to_safe", 0),
        "low_to_high": breakdown.get("low_to_high", 0),
        "low_to_safe": breakdown.get("low_to_safe", 0),
        "safe_to_high": breakdown.get("safe_to_high", 0),
        "safe_to_low": breakdown.get("safe_to_low", 0),
    }


async def get_top_malicious_domains(
    db: AsyncSession, limit: int = 10
) -> List[Dict[str, Any]]:
    """Top sender domains associated with high/low malicious emails."""
    rows = await db.execute(
        select(
            Email.sender_domain,
            func.count(Email.id).label("count"),
        )
        .where(Email.ai_category.in_(["high_malicious", "low_malicious"]))
        .group_by(Email.sender_domain)
        .order_by(func.count(Email.id).desc())
        .limit(limit)
    )
    return [{"domain": r.sender_domain, "count": r.count} for r in rows]


async def get_phishing_keywords(
    db: AsyncSession, limit: int = 12
) -> List[Dict[str, Any]]:
    """
    Aggregate keyword hit counts from AI reasoning bullets.
    This is an approximate match — counts emails whose reasoning mentions each term.
    For production replace with a dedicated keyword_hits table populated at ingestion.
    """
    # We use a raw SQL unnest + ILIKE approach on the ai_reasoning array
    sql = text(
        """
        SELECT kw.keyword, COUNT(*) AS count
        FROM emails e,
             unnest(e.ai_reasoning) AS reason,
             (VALUES
               ('verify your account'),('urgent action required'),
               ('password expired'),('wire transfer'),
               ('confirm your identity'),('unusual activity'),
               ('click here immediately'),('account suspended'),
               ('invoice attached'),('delivery failed'),
               ('sign the document'),('subscription renewal')
             ) AS kw(keyword)
        WHERE reason ILIKE '%' || kw.keyword || '%'
          AND e.ai_category IN ('high_malicious','low_malicious')
        GROUP BY kw.keyword
        ORDER BY count DESC
        LIMIT :limit
        """
    )
    rows = await db.execute(sql, {"limit": limit})
    return [{"keyword": r.keyword, "count": r.count} for r in rows]


async def get_analyst_activity(db: AsyncSession) -> List[Dict[str, Any]]:
    """Per-analyst review and override counts from the audit log."""
    rows = await db.execute(
        select(
            AuditLog.analyst,
            func.count(AuditLog.id).label("total_actions"),
            func.count(case((AuditLog.action == "reviewed", 1))).label("reviewed_count"),
            func.count(case((AuditLog.action == "override", 1))).label("override_count"),
        )
        .where(AuditLog.analyst != "system")
        .group_by(AuditLog.analyst)
        .order_by(func.count(AuditLog.id).desc())
    )
    return [
        {
            "analyst": r.analyst,
            "reviewed_count": r.reviewed_count,
            "override_count": r.override_count,
            # avg_review_time: not tracked yet — return placeholder
            "avg_review_time_minutes": 0.0,
        }
        for r in rows
    ]
