from typing import Optional

from sqlalchemy import BigInteger, Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class AlertRule(Base, TimestampMixin):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rule_type: Mapped[str] = mapped_column(String(50), nullable=False)
    threshold_value: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    window_hours: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    window_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class AlertEvent(Base, TimestampMixin):
    __tablename__ = "alert_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    rule_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    severity: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    triggered_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    acknowledged_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    resolved_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
