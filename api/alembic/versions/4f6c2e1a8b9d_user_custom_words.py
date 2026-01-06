"""user_custom_words

Revision ID: 4f6c2e1a8b9d
Revises: 2f6c1d5e0a43
Create Date: 2026-01-05 23:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "4f6c2e1a8b9d"
down_revision = "2f6c1d5e0a43"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_custom_words",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("word_id", sa.BigInteger(), nullable=False),
        sa.Column("target_lang", sa.String(length=2), nullable=False),
        sa.Column("translation", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "word_id", "target_lang", name="uq_user_custom_words"),
    )
    op.create_index("ix_user_custom_words_user", "user_custom_words", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_custom_words_user", table_name="user_custom_words")
    op.drop_table("user_custom_words")
