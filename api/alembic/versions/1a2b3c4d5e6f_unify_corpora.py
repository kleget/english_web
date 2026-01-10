"""unify corpora

Revision ID: 1a2b3c4d5e6f
Revises: 0f1a2b3c4d5e
Create Date: 2026-01-10 18:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "1a2b3c4d5e6f"
down_revision = "0f1a2b3c4d5e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("corpora", "source_lang")
    op.drop_column("corpora", "target_lang")


def downgrade() -> None:
    op.add_column("corpora", sa.Column("source_lang", sa.String(length=2), nullable=False))
    op.add_column("corpora", sa.Column("target_lang", sa.String(length=2), nullable=False))
