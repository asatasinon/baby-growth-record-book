"""ORM Base and shared mixins for all models."""

import time
from typing import Optional

from sqlalchemy import BigInteger
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """created_at / updated_at 统一为 UTC 毫秒时间戳（BIGINT）。"""

    created_at: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=lambda: int(time.time() * 1000),
    )
    updated_at: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=lambda: int(time.time() * 1000),
        onupdate=lambda: int(time.time() * 1000),
    )


class SoftDeleteMixin:
    """软删除支持：deleted_at 非空表示已删除。"""

    deleted_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True, default=None)
