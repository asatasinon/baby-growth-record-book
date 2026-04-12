from typing import Optional

from sqlalchemy import BigInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class Family(Base, TimestampMixin):
    __tablename__ = "families"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Asia/Shanghai")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class FamilyMember(Base, TimestampMixin):
    __tablename__ = "family_members"
    __table_args__ = (
        UniqueConstraint("family_id", "user_id", name="uq_family_members_family_user"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    invited_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    joined_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
