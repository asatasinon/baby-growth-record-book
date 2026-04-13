"""add password_hash column to users

Revision ID: 20260413_0001
Revises:
Create Date: 2026-04-13 01:15:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260413_0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "users" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" in columns:
        return

    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "users" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("users")}
    if "password_hash" not in columns:
        return

    op.drop_column("users", "password_hash")
