"""
app/routers/analytics.py — Analytics aggregation endpoints.

GET /api/analytics/accuracy
GET /api/analytics/category-trend?days=30
GET /api/analytics/top-domains?limit=10
GET /api/analytics/keywords?limit=12
GET /api/analytics/analyst-activity
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.analytics import (
    AccuracyStats,
    AnalystActivity,
    CategoryTrendDay,
    DomainCount,
    KeywordCount,
)
from app.services.analytics import (
    get_accuracy_stats,
    get_analyst_activity,
    get_category_trend,
    get_phishing_keywords,
    get_top_malicious_domains,
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/accuracy", response_model=AccuracyStats)
async def accuracy(db: AsyncSession = Depends(get_db)) -> AccuracyStats:
    data = await get_accuracy_stats(db)
    return AccuracyStats(**data)


@router.get("/category-trend", response_model=List[CategoryTrendDay])
async def category_trend(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> List[CategoryTrendDay]:
    rows = await get_category_trend(db, days=days)
    return [CategoryTrendDay(**r) for r in rows]


@router.get("/top-domains", response_model=List[DomainCount])
async def top_domains(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> List[DomainCount]:
    rows = await get_top_malicious_domains(db, limit=limit)
    return [DomainCount(**r) for r in rows]


@router.get("/keywords", response_model=List[KeywordCount])
async def keywords(
    limit: int = Query(12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> List[KeywordCount]:
    rows = await get_phishing_keywords(db, limit=limit)
    return [KeywordCount(**r) for r in rows]


@router.get("/analyst-activity", response_model=List[AnalystActivity])
async def analyst_activity(
    db: AsyncSession = Depends(get_db),
) -> List[AnalystActivity]:
    rows = await get_analyst_activity(db)
    return [AnalystActivity(**r) for r in rows]
