"""profile theme

Revision ID: 8f2c4f3a9c1b
Revises: 03d24b1be473
Create Date: 2026-01-05 02:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "8f2c4f3a9c1b"
down_revision = "03d24b1be473"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_profile",
        sa.Column("theme", sa.String(length=8), server_default="light", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("user_profile", "theme")
