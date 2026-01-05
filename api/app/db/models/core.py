import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserProfile(Base):
    __tablename__ = "user_profile"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    interface_lang: Mapped[str] = mapped_column(String(2))
    theme: Mapped[str] = mapped_column(String(8), default="light")
    native_lang: Mapped[str] = mapped_column(String(2))
    target_lang: Mapped[str] = mapped_column(String(2))
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_done: Mapped[bool] = mapped_column(Boolean, default=False)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    daily_new_words: Mapped[int] = mapped_column(Integer, default=5)
    daily_review_words: Mapped[int] = mapped_column(Integer, default=10)
    learn_batch_size: Mapped[int] = mapped_column(Integer, default=5)


class Corpus(Base):
    __tablename__ = "corpora"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(128))
    source_lang: Mapped[str] = mapped_column(String(2))
    target_lang: Mapped[str] = mapped_column(String(2))


class UserCorpus(Base):
    __tablename__ = "user_corpora"
    __table_args__ = (
        UniqueConstraint("user_id", "corpus_id", name="uq_user_corpora"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    corpus_id: Mapped[int] = mapped_column(
        ForeignKey("corpora.id", ondelete="CASCADE"),
        primary_key=True,
    )
    target_word_limit: Mapped[int] = mapped_column(Integer, default=0)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Word(Base):
    __tablename__ = "words"
    __table_args__ = (
        UniqueConstraint("lemma", "lang", name="uq_words_lemma_lang"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    lemma: Mapped[str] = mapped_column(String(255))
    lang: Mapped[str] = mapped_column(String(2))


class CorpusWordStat(Base):
    __tablename__ = "corpus_word_stats"
    __table_args__ = (
        Index("ix_corpus_word_stats_corpus_count", "corpus_id", "count"),
    )

    corpus_id: Mapped[int] = mapped_column(
        ForeignKey("corpora.id", ondelete="CASCADE"),
        primary_key=True,
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"),
        primary_key=True,
    )
    count: Mapped[int] = mapped_column(Integer)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)


class Translation(Base):
    __tablename__ = "translations"
    __table_args__ = (
        UniqueConstraint("word_id", "target_lang", "translation", name="uq_translations_word_target"),
        Index("ix_translations_word", "word_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"))
    target_lang: Mapped[str] = mapped_column(String(2))
    translation: Mapped[str] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(String(64), nullable=True)


class UserWord(Base):
    __tablename__ = "user_words"
    __table_args__ = (
        Index("ix_user_words_next_review", "next_review_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    word_id: Mapped[int] = mapped_column(
        ForeignKey("words.id", ondelete="CASCADE"),
        primary_key=True,
    )
    status: Mapped[str] = mapped_column(String(16), default="new")
    stage: Mapped[int] = mapped_column(Integer, default=0)
    learned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_review_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    correct_streak: Mapped[int] = mapped_column(Integer, default=0)
    wrong_streak: Mapped[int] = mapped_column(Integer, default=0)


class StudySession(Base):
    __tablename__ = "study_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    session_type: Mapped[str] = mapped_column(String(16))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    words_total: Mapped[int] = mapped_column(Integer, default=0)
    words_correct: Mapped[int] = mapped_column(Integer, default=0)


class ReviewEvent(Base):
    __tablename__ = "review_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    word_id: Mapped[int] = mapped_column(ForeignKey("words.id", ondelete="CASCADE"))
    result: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
