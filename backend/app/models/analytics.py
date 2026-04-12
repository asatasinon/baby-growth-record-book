from typing import Optional

from sqlalchemy import BigInteger, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class MetricSnapshot(Base, TimestampMixin):
    __tablename__ = "metric_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "baby_id", "metric_code", "bucket_type", "bucket_date",
            name="uq_metric_snapshots_baby_code_type_date",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    metric_code: Mapped[str] = mapped_column(String(50), nullable=False)
    bucket_type: Mapped[str] = mapped_column(String(20), nullable=False)
    bucket_date: Mapped[int] = mapped_column(BigInteger, nullable=False)
    metric_value: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    metric_unit: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
