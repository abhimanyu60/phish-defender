"""
app/schemas/analytics.py — Pydantic schemas for the analytics endpoints.
"""
from __future__ import annotations

from typing import List

from pydantic import BaseModel


class AccuracyStats(BaseModel):
    ai_agreement_rate: float    # 0.0 – 1.0 (e.g. 0.873)
    total_reviewed: int
    total_overrides: int
    # Override direction breakdown
    high_to_low: int
    high_to_safe: int
    low_to_high: int
    low_to_safe: int
    safe_to_high: int
    safe_to_low: int


class DomainCount(BaseModel):
    domain: str
    count: int


class KeywordCount(BaseModel):
    keyword: str
    count: int


class AnalystActivity(BaseModel):
    analyst: str
    reviewed_count: int
    override_count: int
    avg_review_time_minutes: float


class CategoryTrendDay(BaseModel):
    date: str          # "YYYY-MM-DD"
    high_malicious: int
    low_malicious: int
    safe: int
