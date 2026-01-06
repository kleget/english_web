"""learning profiles

Revision ID: c9f1a2b3c4d5
Revises: 4f6c2e1a8b9d
Create Date: 2026-01-06 00:05:00.000000
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa


revision = "c9f1a2b3c4d5"
down_revision = "4f6c2e1a8b9d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    def drop_primary_key(table_name: str) -> None:
        op.execute(
            f"""
            DO $$
            DECLARE
                constraint_name text;
            BEGIN
                SELECT conname INTO constraint_name
                FROM pg_constraint
                WHERE conrelid = '{table_name}'::regclass
                  AND contype = 'p';
                IF constraint_name IS NOT NULL THEN
                    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', '{table_name}', constraint_name);
                END IF;
            END$$;
            """
        )

    op.create_table(
        "learning_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("native_lang", sa.String(length=2), nullable=False),
        sa.Column("target_lang", sa.String(length=2), nullable=False),
        sa.Column("onboarding_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "native_lang",
            "target_lang",
            name="uq_learning_profiles_user_lang",
        ),
    )

    op.add_column("user_profile", sa.Column("active_profile_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_user_profile_active_profile",
        "user_profile",
        "learning_profiles",
        ["active_profile_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.add_column("user_settings", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.add_column("user_corpora", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.add_column("user_custom_words", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.add_column("user_words", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.add_column("study_sessions", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.add_column("review_events", sa.Column("profile_id", sa.UUID(), nullable=True))

    op.create_foreign_key(
        "fk_user_settings_profile",
        "user_settings",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_user_corpora_profile",
        "user_corpora",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_user_custom_words_profile",
        "user_custom_words",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_user_words_profile",
        "user_words",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_study_sessions_profile",
        "study_sessions",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_review_events_profile",
        "review_events",
        "learning_profiles",
        ["profile_id"],
        ["id"],
        ondelete="CASCADE",
    )

    bind = op.get_bind()
    profiles = bind.execute(
        sa.text(
            """
            SELECT up.user_id, up.native_lang, up.target_lang, up.onboarding_done, u.created_at
            FROM user_profile AS up
            JOIN users AS u ON u.id = up.user_id
            WHERE up.native_lang IS NOT NULL AND up.target_lang IS NOT NULL
            """
        )
    ).fetchall()

    for row in profiles:
        profile_id = uuid.uuid4()
        bind.execute(
            sa.text(
                """
                INSERT INTO learning_profiles
                    (id, user_id, native_lang, target_lang, onboarding_done, created_at)
                VALUES
                    (:id, :user_id, :native_lang, :target_lang, :onboarding_done, :created_at)
                """
            ),
            {
                "id": profile_id,
                "user_id": row.user_id,
                "native_lang": row.native_lang,
                "target_lang": row.target_lang,
                "onboarding_done": row.onboarding_done,
                "created_at": row.created_at,
            },
        )
        bind.execute(
            sa.text(
                "UPDATE user_profile SET active_profile_id = :profile_id WHERE user_id = :user_id"
            ),
            {"profile_id": profile_id, "user_id": row.user_id},
        )

    bind.execute(
        sa.text(
            """
            UPDATE user_settings
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE user_settings.user_id = up.user_id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE user_corpora
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE user_corpora.user_id = up.user_id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE user_custom_words
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE user_custom_words.user_id = up.user_id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE user_words
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE user_words.user_id = up.user_id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE study_sessions
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE study_sessions.user_id = up.user_id
            """
        )
    )
    bind.execute(
        sa.text(
            """
            UPDATE review_events
            SET profile_id = up.active_profile_id
            FROM user_profile AS up
            WHERE review_events.user_id = up.user_id
            """
        )
    )

    bind.execute(sa.text("DELETE FROM user_settings WHERE profile_id IS NULL"))
    bind.execute(sa.text("DELETE FROM user_corpora WHERE profile_id IS NULL"))
    bind.execute(sa.text("DELETE FROM user_custom_words WHERE profile_id IS NULL"))
    bind.execute(sa.text("DELETE FROM user_words WHERE profile_id IS NULL"))
    bind.execute(sa.text("DELETE FROM study_sessions WHERE profile_id IS NULL"))
    bind.execute(sa.text("DELETE FROM review_events WHERE profile_id IS NULL"))

    op.alter_column("user_settings", "profile_id", nullable=False)
    op.alter_column("user_corpora", "profile_id", nullable=False)
    op.alter_column("user_custom_words", "profile_id", nullable=False)
    op.alter_column("user_words", "profile_id", nullable=False)
    op.alter_column("study_sessions", "profile_id", nullable=False)
    op.alter_column("review_events", "profile_id", nullable=False)

    drop_primary_key("user_settings")
    op.create_primary_key("user_settings_pkey", "user_settings", ["profile_id"])

    drop_primary_key("user_corpora")
    op.create_primary_key("user_corpora_pkey", "user_corpora", ["profile_id", "corpus_id"])
    op.execute("ALTER TABLE user_corpora DROP CONSTRAINT IF EXISTS uq_user_corpora")
    op.create_unique_constraint("uq_user_corpora", "user_corpora", ["profile_id", "corpus_id"])

    op.execute("ALTER TABLE user_custom_words DROP CONSTRAINT IF EXISTS uq_user_custom_words")
    op.create_unique_constraint(
        "uq_user_custom_words",
        "user_custom_words",
        ["profile_id", "word_id", "target_lang"],
    )
    op.execute("DROP INDEX IF EXISTS ix_user_custom_words_user")
    op.create_index(
        "ix_user_custom_words_profile",
        "user_custom_words",
        ["profile_id"],
        unique=False,
    )

    drop_primary_key("user_words")
    op.create_primary_key("user_words_pkey", "user_words", ["profile_id", "word_id"])


def downgrade() -> None:
    op.drop_constraint("user_words_pkey", "user_words", type_="primary")
    op.create_primary_key("user_words_pkey", "user_words", ["user_id", "word_id"])

    op.drop_index("ix_user_custom_words_profile", table_name="user_custom_words")
    op.create_index(
        "ix_user_custom_words_user",
        "user_custom_words",
        ["user_id"],
        unique=False,
    )
    op.drop_constraint("uq_user_custom_words", "user_custom_words", type_="unique")
    op.create_unique_constraint(
        "uq_user_custom_words",
        "user_custom_words",
        ["user_id", "word_id", "target_lang"],
    )

    op.drop_constraint("uq_user_corpora", "user_corpora", type_="unique")
    op.create_unique_constraint("uq_user_corpora", "user_corpora", ["user_id", "corpus_id"])
    op.drop_constraint("user_corpora_pkey", "user_corpora", type_="primary")
    op.create_primary_key("user_corpora_pkey", "user_corpora", ["user_id", "corpus_id"])

    op.drop_constraint("user_settings_pkey", "user_settings", type_="primary")
    op.create_primary_key("user_settings_pkey", "user_settings", ["user_id"])

    op.drop_constraint("fk_review_events_profile", "review_events", type_="foreignkey")
    op.drop_constraint("fk_study_sessions_profile", "study_sessions", type_="foreignkey")
    op.drop_constraint("fk_user_words_profile", "user_words", type_="foreignkey")
    op.drop_constraint("fk_user_custom_words_profile", "user_custom_words", type_="foreignkey")
    op.drop_constraint("fk_user_corpora_profile", "user_corpora", type_="foreignkey")
    op.drop_constraint("fk_user_settings_profile", "user_settings", type_="foreignkey")
    op.drop_constraint("fk_user_profile_active_profile", "user_profile", type_="foreignkey")

    op.drop_column("review_events", "profile_id")
    op.drop_column("study_sessions", "profile_id")
    op.drop_column("user_words", "profile_id")
    op.drop_column("user_custom_words", "profile_id")
    op.drop_column("user_corpora", "profile_id")
    op.drop_column("user_settings", "profile_id")
    op.drop_column("user_profile", "active_profile_id")

    op.drop_table("learning_profiles")
