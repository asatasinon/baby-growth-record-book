from typing import Optional

from sqlalchemy import BigInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, TimestampMixin


class ExportTask(Base, TimestampMixin):
    __tablename__ = "export_tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    family_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    baby_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    report_type: Mapped[str] = mapped_column(String(20), nullable=False)
    date_from: Mapped[int] = mapped_column(BigInteger, nullable=False)
    date_to: Mapped[int] = mapped_column(BigInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    object_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    download_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    requested_by: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
