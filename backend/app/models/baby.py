from typing import Optional

from sqlalchemy import BigInteger, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class Baby(Base, TimestampMixin):
    __tablename__ = "babies"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    nickname: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gender: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    birth_date: Mapped[int] = mapped_column(BigInteger, nullable=False)
    birth_place: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    due_date: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    birth_weight_g: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    birth_height_cm: Mapped[Optional[float]] = mapped_column(Numeric(6, 2), nullable=True)
    birth_head_circumference_cm: Mapped[Optional[float]] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
