"""add family/member/baby profile management fields

Revision ID: 20260413_0003
Revises: 20260413_0002
Create Date: 2026-04-13 16:20:00
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260413_0003"
down_revision: str | None = "20260413_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS family_alias VARCHAR(100);")
    op.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS city VARCHAR(100);")
    op.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS address VARCHAR(255);")
    op.execute("ALTER TABLE families ADD COLUMN IF NOT EXISTS notes VARCHAR(500);")

    op.execute("ALTER TABLE family_members ADD COLUMN IF NOT EXISTS relation_label VARCHAR(50);")

    op.execute("ALTER TABLE babies ADD COLUMN IF NOT EXISTS birth_place VARCHAR(200);")


def downgrade() -> None:
    op.execute("ALTER TABLE babies DROP COLUMN IF EXISTS birth_place;")

    op.execute("ALTER TABLE family_members DROP COLUMN IF EXISTS relation_label;")

    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS notes;")
    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS address;")
    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS city;")
    op.execute("ALTER TABLE families DROP COLUMN IF EXISTS family_alias;")
