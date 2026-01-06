"""content reports

Revision ID: a3b4c5d6e7f8
Revises: e2c1d4f5a6b7
Create Date: 2026-01-06 04:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a3b4c5d6e7f8"
down_revision = "e2c1d4f5a6b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "content_reports",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=True),
        sa.Column("corpus_id", sa.BigInteger(), nullable=True),
        sa.Column("word_id", sa.BigInteger(), nullable=True),
        sa.Column("translation_id", sa.BigInteger(), nullable=True),
        sa.Column("issue_type", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        sa.Column("source", sa.String(length=32), nullable=True),
        sa.Column("word_text", sa.Text(), nullable=True),
        sa.Column("translation_text", sa.Text(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["corpus_id"], ["corpora.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["profile_id"], ["learning_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["translation_id"], ["translations.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["word_id"], ["words.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_content_reports_status", "content_reports", ["status"], unique=False)
    op.create_index("ix_content_reports_created", "content_reports", ["created_at"], unique=False)
    op.create_index("ix_content_reports_word", "content_reports", ["word_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_content_reports_word", table_name="content_reports")
    op.drop_index("ix_content_reports_created", table_name="content_reports")
    op.drop_index("ix_content_reports_status", table_name="content_reports")
    op.drop_table("content_reports")
