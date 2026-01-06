"""social features

Revision ID: d7e8f9a0b1c2
Revises: c9f1a2b3c4d5
Create Date: 2026-01-06 01:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "d7e8f9a0b1c2"
down_revision = "c9f1a2b3c4d5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_public_profiles",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("handle", sa.String(length=32), nullable=False),
        sa.Column("display_name", sa.String(length=64), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("handle", name="uq_user_public_profiles_handle"),
    )
    op.create_index("ix_user_public_profiles_handle", "user_public_profiles", ["handle"], unique=False)

    op.create_table(
        "user_follows",
        sa.Column("follower_id", sa.UUID(), nullable=False),
        sa.Column("followee_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["follower_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["followee_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("follower_id", "followee_id"),
        sa.UniqueConstraint("follower_id", "followee_id", name="uq_user_follows"),
    )
    op.create_index("ix_user_follows_follower", "user_follows", ["follower_id"], unique=False)
    op.create_index("ix_user_follows_followee", "user_follows", ["followee_id"], unique=False)

    op.create_table(
        "user_challenges",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column("challenge_key", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False, server_default="active"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["profile_id"], ["learning_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_challenges_user", "user_challenges", ["user_id"], unique=False)
    op.create_index("ix_user_challenges_profile", "user_challenges", ["profile_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_user_challenges_profile", table_name="user_challenges")
    op.drop_index("ix_user_challenges_user", table_name="user_challenges")
    op.drop_table("user_challenges")

    op.drop_index("ix_user_follows_followee", table_name="user_follows")
    op.drop_index("ix_user_follows_follower", table_name="user_follows")
    op.drop_table("user_follows")

    op.drop_index("ix_user_public_profiles_handle", table_name="user_public_profiles")
    op.drop_table("user_public_profiles")
