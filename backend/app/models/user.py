from typing import Optional

from sqlalchemy import BigInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_ciphertext: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    last_login_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)


class UserIdentity(Base, TimestampMixin):
    __tablename__ = "user_identities"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_identities_user_provider"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    provider: Mapped[str] = mapped_column(String(30), nullable=False)
    openid_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    unionid_ciphertext: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
