from typing import Optional

from sqlalchemy import BigInteger, Boolean, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, SoftDeleteMixin, TimestampMixin


class GrowthEvent(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "growth_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)
    occurred_at: Mapped[int] = mapped_column(BigInteger, nullable=False)
    start_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    end_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="miniapp")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload_snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class FeedingEvent(Base):
    __tablename__ = "feeding_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    mode: Mapped[str] = mapped_column(String(30), nullable=False)
    volume: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(10), nullable=False, default="ml")
    is_night: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class ExcretionEvent(Base):
    __tablename__ = "excretion_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    excretion_type: Mapped[str] = mapped_column(String(20), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    texture: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    is_abnormal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MeasurementEvent(Base):
    __tablename__ = "measurement_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    weight_g: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    head_circumference_cm: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    hand_length_cm: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    leg_length_cm: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    temperature_c: Mapped[Optional[float]] = mapped_column(Numeric(4, 2), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class SleepEvent(Base):
    __tablename__ = "sleep_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    night_wake_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quality_tag: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MedicationEvent(Base):
    __tablename__ = "medication_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    medicine_name: Mapped[str] = mapped_column(String(120), nullable=False)
    dosage: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)
    dosage_unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    planned_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    taken_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    execution_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class VaccineEvent(Base):
    __tablename__ = "vaccine_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    vaccine_name: Mapped[str] = mapped_column(String(120), nullable=False)
    planned_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    completed_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    institution_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    batch_no: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="planned")
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)


class MilestoneEvent(Base):
    __tablename__ = "milestone_events"

    event_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    milestone_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
