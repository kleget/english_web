from __future__ import annotations

import re
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models import (
    CorpusWordStat,
    ReviewEvent,
    StudySession,
    Translation,
    User,
    UserCorpus,
    UserProfile,
    UserSettings,
    UserWord,
    Word,
)
from app.schemas.study import (
    LearnStartOut,
    LearnSubmitOut,
    LearnSubmitRequest,
    LearnWordOut,
    ReviewSeedOut,
    ReviewStartOut,
    ReviewSubmitOut,
    ReviewSubmitRequest,
    ReviewWordOut,
)

router = APIRouter(prefix="/study", tags=["study"])

REVIEW_INTERVALS_DAYS = [1, 3, 7, 21, 90]


async def load_profile_settings(user_id, db: AsyncSession) -> tuple[UserProfile, UserSettings]:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.onboarding_done:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")
    if not profile.native_lang or not profile.target_lang:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")

    settings_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(user_id=user_id)
        db.add(settings)
        await db.commit()
    return profile, settings


async def fetch_learn_words(
    user_id,
    target_lang: str,
    limit: int,
    db: AsyncSession,
) -> list[LearnWordOut]:
    stmt = (
        select(
            Word.id.label("word_id"),
            Word.lemma.label("lemma"),
            func.min(Translation.translation).label("translation"),
            func.min(CorpusWordStat.rank).label("rank"),
            func.max(CorpusWordStat.count).label("count"),
        )
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .join(Word, Word.id == CorpusWordStat.word_id)
        .join(
            Translation,
            and_(Translation.word_id == Word.id, Translation.target_lang == target_lang),
        )
        .outerjoin(
            UserWord,
            and_(UserWord.user_id == user_id, UserWord.word_id == Word.id),
        )
        .where(UserCorpus.user_id == user_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
        .group_by(Word.id, Word.lemma)
        .order_by(func.min(CorpusWordStat.rank).nulls_last(), Word.id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        LearnWordOut(
            word_id=row.word_id,
            word=row.lemma,
            translation=row.translation,
            rank=row.rank,
            count=row.count,
        )
        for row in result.fetchall()
    ]


async def fetch_review_words(
    user_id,
    target_lang: str,
    limit: int,
    now: datetime,
    db: AsyncSession,
) -> list[ReviewWordOut]:
    stmt = (
        select(
            UserWord.word_id,
            Word.lemma,
            func.min(Translation.translation).label("translation"),
            UserWord.learned_at,
            UserWord.next_review_at,
            UserWord.stage,
        )
        .select_from(UserWord)
        .join(Word, Word.id == UserWord.word_id)
        .join(
            Translation,
            and_(Translation.word_id == Word.id, Translation.target_lang == target_lang),
        )
        .where(
            UserWord.user_id == user_id,
            UserWord.next_review_at.is_not(None),
            UserWord.next_review_at <= now,
        )
        .group_by(
            UserWord.word_id,
            Word.lemma,
            UserWord.learned_at,
            UserWord.next_review_at,
            UserWord.stage,
        )
        .order_by(UserWord.next_review_at, UserWord.word_id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        ReviewWordOut(
            word_id=row.word_id,
            word=row.lemma,
            translation=row.translation,
            learned_at=row.learned_at,
            next_review_at=row.next_review_at,
            stage=row.stage,
        )
        for row in result.fetchall()
    ]


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def build_translation_options(translations: list[str]) -> set[str]:
    options: set[str] = set()
    for text in translations:
        for part in re.split(r"[;,/]", text or ""):
            normalized = normalize_text(part)
            if normalized:
                options.add(normalized)
    return options


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i]
        for j, char_b in enumerate(b, start=1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (char_a != char_b)
            current.append(min(insert_cost, delete_cost, replace_cost))
        previous = current
    return previous[-1]


def is_fuzzy_match(answer: str, option: str) -> bool:
    if not answer or not option:
        return False
    if answer == option:
        return True
    if abs(len(answer) - len(option)) > 2:
        return False
    min_len = min(len(answer), len(option))
    if min_len <= 6:
        return edit_distance(answer, option) <= 1
    if min_len <= 8:
        return edit_distance(answer, option) <= 2
    ratio = SequenceMatcher(None, answer, option).ratio()
    return ratio >= 0.88


async def fetch_translation_map(
    word_ids: list[int],
    target_lang: str,
    db: AsyncSession,
) -> dict[int, list[str]]:
    if not word_ids:
        return {}
    result = await db.execute(
        select(Translation.word_id, Translation.translation).where(
            Translation.word_id.in_(word_ids),
            Translation.target_lang == target_lang,
        )
    )
    mapping: dict[int, list[str]] = {}
    for word_id, translation in result.fetchall():
        mapping.setdefault(word_id, []).append(translation)
    return mapping


def is_answer_correct(answer: str, translations: list[str]) -> bool:
    normalized = normalize_text(answer or "")
    if not normalized:
        return False
    options = build_translation_options(translations)
    if normalized in options:
        return True
    return any(is_fuzzy_match(normalized, option) for option in options)


def next_review_after(correct: bool, current_stage: int, now: datetime) -> tuple[int, datetime]:
    if not correct:
        return 0, now
    next_stage = min(current_stage + 1, len(REVIEW_INTERVALS_DAYS))
    days = REVIEW_INTERVALS_DAYS[next_stage - 1]
    return next_stage, now + timedelta(days=days)


async def seed_review_words(
    user_id,
    limit: int,
    db: AsyncSession,
) -> int:
    stmt = (
        select(Word.id)
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .join(Word, Word.id == CorpusWordStat.word_id)
        .outerjoin(UserWord, and_(UserWord.user_id == user_id, UserWord.word_id == Word.id))
        .where(UserCorpus.user_id == user_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
        .group_by(Word.id)
        .order_by(func.min(CorpusWordStat.rank).nulls_last(), Word.id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    word_ids = [row[0] for row in result.fetchall()]
    if not word_ids:
        return 0

    now = datetime.now(timezone.utc)
    rows = [
        {
            "user_id": user_id,
            "word_id": word_id,
            "status": "learned",
            "stage": 0,
            "learned_at": now,
            "last_review_at": now,
            "next_review_at": now,
            "correct_streak": 0,
            "wrong_streak": 0,
        }
        for word_id in word_ids
    ]
    stmt = insert(UserWord).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "word_id"])
    result = await db.execute(stmt)
    await db.commit()
    return int(result.rowcount or 0)


@router.post("/learn/start", response_model=LearnStartOut)
async def start_learn(
    limit: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LearnStartOut:
    profile, settings = await load_profile_settings(user.id, db)
    batch_size = limit if limit and limit > 0 else settings.learn_batch_size
    if batch_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid batch size")

    words = await fetch_learn_words(user.id, profile.target_lang, batch_size, db)
    if not words:
        return LearnStartOut(session_id=None, words=[])

    session = StudySession(
        user_id=user.id,
        session_type="learn",
        words_total=len(words),
    )
    db.add(session)
    await db.flush()
    await db.commit()

    return LearnStartOut(session_id=session.id, words=words)


@router.post("/learn/submit", response_model=LearnSubmitOut)
async def submit_learn(
    data: LearnSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LearnSubmitOut:
    if not data.words:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No answers")

    profile, _settings = await load_profile_settings(user.id, db)

    word_ids = [item.word_id for item in data.words]
    if len(set(word_ids)) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate word ids")
    translation_map = await fetch_translation_map(word_ids, profile.target_lang, db)

    session = None
    if data.session_id is not None:
        session_result = await db.execute(
            select(StudySession).where(
                StudySession.id == data.session_id, StudySession.user_id == user.id
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.now(timezone.utc)
    words_total = len(data.words)
    words_correct = 0
    results = []
    for item in data.words:
        translations = translation_map.get(item.word_id, [])
        options = sorted(build_translation_options(translations))
        correct = is_answer_correct(item.answer, translations)
        results.append(
            {
                "word_id": item.word_id,
                "correct": correct,
                "correct_answers": options,
            }
        )
        if correct:
            words_correct += 1
    all_correct = words_correct == words_total

    if session is not None:
        session.words_total = words_total
        session.words_correct = words_correct
        session.finished_at = now

    learned = 0
    if all_correct:
        rows = [
            {
                "user_id": user.id,
                "word_id": item.word_id,
                "status": "learned",
                "stage": 1,
                "learned_at": now,
                "last_review_at": now,
                "next_review_at": now + timedelta(days=1),
                "correct_streak": 1,
                "wrong_streak": 0,
            }
            for item in data.words
        ]
        stmt = insert(UserWord).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "word_id"])
        result = await db.execute(stmt)
        learned = int(result.rowcount or 0)

    await db.commit()

    return LearnSubmitOut(
        all_correct=all_correct,
        words_total=words_total,
        words_correct=words_correct,
        learned=learned,
        results=results,
    )


@router.post("/review/start", response_model=ReviewStartOut)
async def start_review(
    limit: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewStartOut:
    profile, settings = await load_profile_settings(user.id, db)
    batch_size = limit if limit and limit > 0 else settings.daily_review_words
    if batch_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid batch size")

    now = datetime.now(timezone.utc)
    words = await fetch_review_words(user.id, profile.target_lang, batch_size, now, db)
    if not words:
        return ReviewStartOut(session_id=None, words=[])

    session = StudySession(
        user_id=user.id,
        session_type="review",
        words_total=len(words),
    )
    db.add(session)
    await db.flush()
    await db.commit()

    return ReviewStartOut(session_id=session.id, words=words)


@router.post("/review/submit", response_model=ReviewSubmitOut)
async def submit_review(
    data: ReviewSubmitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewSubmitOut:
    if not data.words:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No answers")

    profile, _settings = await load_profile_settings(user.id, db)

    word_ids = [item.word_id for item in data.words]
    if len(set(word_ids)) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate word ids")

    session = None
    if data.session_id is not None:
        session_result = await db.execute(
            select(StudySession).where(
                StudySession.id == data.session_id, StudySession.user_id == user.id
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    rows_result = await db.execute(
        select(UserWord).where(UserWord.user_id == user.id, UserWord.word_id.in_(word_ids))
    )
    user_words = {row.word_id: row for row in rows_result.scalars().all()}
    if len(user_words) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word not found")

    translation_map = await fetch_translation_map(word_ids, profile.target_lang, db)

    now = datetime.now(timezone.utc)
    words_total = len(data.words)
    words_correct = 0
    words_incorrect = 0
    results = []

    review_events = []
    for item in data.words:
        current = user_words[item.word_id]
        stage = current.stage or 0
        translations = translation_map.get(item.word_id, [])
        options = sorted(build_translation_options(translations))
        correct = is_answer_correct(item.answer, translations)
        results.append(
            {
                "word_id": item.word_id,
                "correct": correct,
                "correct_answers": options,
            }
        )
        next_stage, next_review_at = next_review_after(correct, stage, now)
        current.stage = next_stage
        current.last_review_at = now
        current.next_review_at = next_review_at
        if correct:
            current.correct_streak = (current.correct_streak or 0) + 1
            current.wrong_streak = 0
            if current.status not in {"known", "learned"}:
                current.status = "learned"
            words_correct += 1
            review_events.append(
                ReviewEvent(user_id=user.id, word_id=current.word_id, result="correct")
            )
        else:
            current.correct_streak = 0
            current.wrong_streak = (current.wrong_streak or 0) + 1
            words_incorrect += 1
            review_events.append(
                ReviewEvent(user_id=user.id, word_id=current.word_id, result="wrong")
            )

    if session is not None:
        session.words_total = words_total
        session.words_correct = words_correct
        session.finished_at = now

    if review_events:
        db.add_all(review_events)

    await db.commit()

    return ReviewSubmitOut(
        words_total=words_total,
        words_correct=words_correct,
        words_incorrect=words_incorrect,
        results=results,
    )


@router.post("/review/seed", response_model=ReviewSeedOut)
async def seed_review(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewSeedOut:
    await load_profile_settings(user.id, db)
    if limit <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    seeded = await seed_review_words(user.id, limit, db)
    return ReviewSeedOut(seeded=seeded)
