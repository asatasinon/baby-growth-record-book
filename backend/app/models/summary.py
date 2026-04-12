from typing import Optional

from sqlalchemy import BigInteger, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class DailySummary(Base, TimestampMixin):
    __tablename__ = "daily_summaries"
    __table_args__ = (
        UniqueConstraint(
            "family_id",
            "baby_id",
            "summary_date",
            name="uq_daily_summaries_family_baby_date",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    summary_date: Mapped[int] = mapped_column(BigInteger, nullable=False)
    feeding_total_ml: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    feeding_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    excretion_count_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    excretion_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    sleep_total_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_measurement_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    alert_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class WeeklySummary(Base, TimestampMixin):
    __tablename__ = "weekly_summaries"
    __table_args__ = (
        UniqueConstraint(
            "family_id",
            "baby_id",
            "week_start",
            name="uq_weekly_summaries_family_baby_week",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    week_start: Mapped[int] = mapped_column(BigInteger, nullable=False)
    summary_payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ai_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
