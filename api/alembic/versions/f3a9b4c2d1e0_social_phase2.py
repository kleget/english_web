"""social phase 2

Revision ID: f3a9b4c2d1e0
Revises: d7e8f9a0b1c2
Create Date: 2026-01-06 02:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f3a9b4c2d1e0"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "friend_requests",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("sender_id", sa.UUID(), nullable=False),
        sa.Column("receiver_id", sa.UUID(), nullable=False),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("sender_id", "receiver_id", name="uq_friend_requests"),
    )
    op.create_index("ix_friend_requests_sender", "friend_requests", ["sender_id"], unique=False)
    op.create_index("ix_friend_requests_receiver", "friend_requests", ["receiver_id"], unique=False)

    op.create_table(
        "friendships",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("friend_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["friend_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "friend_id"),
        sa.UniqueConstraint("user_id", "friend_id", name="uq_friendships"),
    )
    op.create_index("ix_friendships_user", "friendships", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_messages_created", "chat_messages", ["created_at"], unique=False)

    op.create_table(
        "group_challenges",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("challenge_key", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=64), nullable=True),
        sa.Column(
            "status",
            sa.String(length=16),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("invite_code", sa.String(length=12), nullable=False),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("invite_code", name="uq_group_challenges_invite"),
    )
    op.create_index("ix_group_challenges_owner", "group_challenges", ["owner_id"], unique=False)

    op.create_table(
        "group_challenge_members",
        sa.Column("group_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("profile_id", sa.UUID(), nullable=False),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["group_id"], ["group_challenges.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profile_id"], ["learning_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("group_id", "user_id"),
        sa.UniqueConstraint("group_id", "user_id", name="uq_group_challenge_members"),
    )
    op.create_index(
        "ix_group_challenge_members_group",
        "group_challenge_members",
        ["group_id"],
        unique=False,
    )
    op.create_index(
        "ix_group_challenge_members_user",
        "group_challenge_members",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_group_challenge_members_user", table_name="group_challenge_members")
    op.drop_index("ix_group_challenge_members_group", table_name="group_challenge_members")
    op.drop_table("group_challenge_members")

    op.drop_index("ix_group_challenges_owner", table_name="group_challenges")
    op.drop_table("group_challenges")

    op.drop_index("ix_chat_messages_created", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_friendships_user", table_name="friendships")
    op.drop_table("friendships")

    op.drop_index("ix_friend_requests_receiver", table_name="friend_requests")
    op.drop_index("ix_friend_requests_sender", table_name="friend_requests")
    op.drop_table("friend_requests")
