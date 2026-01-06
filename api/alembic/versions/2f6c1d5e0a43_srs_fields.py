"""add SRS fields to user_words

Revision ID: 2f6c1d5e0a43
Revises: 8f2c4f3a9c1b
Create Date: 2026-01-05 21:25:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "2f6c1d5e0a43"
down_revision = "8f2c4f3a9c1b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "user_words",
        sa.Column("repetitions", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user_words",
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "user_words",
        sa.Column("ease_factor", sa.Float(), nullable=False, server_default="2.5"),
    )
    op.execute(
        """
        UPDATE user_words
        SET repetitions = stage,
            interval_days = CASE
                WHEN stage <= 0 THEN 0
                WHEN stage = 1 THEN 1
                WHEN stage = 2 THEN 3
                WHEN stage = 3 THEN 7
                WHEN stage = 4 THEN 21
                ELSE 90
            END,
            ease_factor = 2.5
        """
    )


def downgrade() -> None:
    op.drop_column("user_words", "ease_factor")
    op.drop_column("user_words", "interval_days")
    op.drop_column("user_words", "repetitions")
