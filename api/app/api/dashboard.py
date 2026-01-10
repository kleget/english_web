from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.models import (
    CorpusWordStat,
    DashboardCache,
    Translation,
    User,
    UserCorpus,
    UserCustomWord,
    UserProfile,
    UserSettings,
    UserWord,
)
from app.schemas.dashboard import DashboardOut, LearnedSeriesPoint

router = APIRouter(tags=["dashboard"])

KNOWN_STATUSES = ("known", "learned")
CACHE_TTL_SECONDS = 120


def days_since(start: datetime, now: datetime) -> int:
    if start is None:
        return 0
    delta = now.date() - start.date()
    return max(delta.days, 0) + 1


def build_series(counts: dict[date, int], start_date: date, days: int) -> list[LearnedSeriesPoint]:
    series: list[LearnedSeriesPoint] = []
    for offset in range(days):
        day = start_date + timedelta(days=offset)
        series.append(LearnedSeriesPoint(date=day, count=counts.get(day, 0)))
    return series


async def count_available_new_words(profile_id, target_lang: str, db: AsyncSession) -> int:
    corpora_subq = (
        select(CorpusWordStat.word_id.label("word_id"))
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .outerjoin(
            UserWord,
            and_(UserWord.profile_id == profile_id, UserWord.word_id == CorpusWordStat.word_id),
        )
        .where(UserCorpus.profile_id == profile_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
    )
    custom_subq = (
        select(UserCustomWord.word_id.label("word_id"))
        .select_from(UserCustomWord)
        .outerjoin(
            UserWord,
            and_(UserWord.profile_id == profile_id, UserWord.word_id == UserCustomWord.word_id),
        )
        .where(
            UserCustomWord.profile_id == profile_id,
            UserCustomWord.target_lang == target_lang,
            UserWord.word_id.is_(None),
        )
    )
    combined = corpora_subq.union(custom_subq).subquery()
    result = await db.execute(select(func.count()).select_from(combined))
    return int(result.scalar() or 0)


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    refresh: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardOut:
    user_profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    user_profile = user_profile_result.scalar_one_or_none()
    if user_profile is None:
        user_profile = UserProfile(user_id=user.id, interface_lang="ru", theme="light")
        db.add(user_profile)
        await db.commit()

    learning_profile = await get_active_learning_profile(user.id, db, require_onboarding=True)

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.profile_id == learning_profile.id)
    )
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(profile_id=learning_profile.id, user_id=user.id)
        db.add(settings)
        await db.commit()

    now = datetime.now(timezone.utc)

    if not refresh:
        cache_result = await db.execute(
            select(DashboardCache).where(DashboardCache.profile_id == learning_profile.id)
        )
        cache = cache_result.scalar_one_or_none()
        if cache and cache.updated_at and now - cache.updated_at <= timedelta(seconds=CACHE_TTL_SECONDS):
            data = dict(cache.data or {})
            data["interface_lang"] = user_profile.interface_lang
            data["theme"] = user_profile.theme or "light"
            data["avatar_url"] = user_profile.avatar_url
            data["email"] = user.email
            return DashboardOut(**data)

    known_stmt = (
        select(func.count())
        .select_from(UserWord)
        .where(UserWord.profile_id == learning_profile.id, UserWord.status.in_(KNOWN_STATUSES))
    )
    known_result = await db.execute(known_stmt)
    known_words = int(known_result.scalar() or 0)

    due_words_subq = (
        select(UserWord.word_id)
        .where(
            UserWord.profile_id == learning_profile.id,
            UserWord.next_review_at.is_not(None),
            UserWord.next_review_at <= now,
        )
        .subquery()
    )
    translation_subq = (
        select(Translation.word_id)
        .where(
            Translation.word_id.in_(select(due_words_subq.c.word_id)),
            Translation.target_lang == learning_profile.target_lang,
        )
    )
    custom_subq = (
        select(UserCustomWord.word_id)
        .where(
            UserCustomWord.profile_id == learning_profile.id,
            UserCustomWord.word_id.in_(select(due_words_subq.c.word_id)),
            UserCustomWord.target_lang == learning_profile.target_lang,
        )
    )
    review_available_result = await db.execute(
        select(func.count()).select_from(translation_subq.union(custom_subq).subquery())
    )
    review_available = int(review_available_result.scalar() or 0)

    learn_available = await count_available_new_words(
        learning_profile.id, learning_profile.target_lang, db
    )
    learn_today = min(settings.daily_new_words, learn_available)
    review_today = min(settings.daily_review_words, review_available)

    days_total = 14
    start_date = (now - timedelta(days=days_total - 1)).date()
    series_stmt = (
        select(func.date_trunc("day", UserWord.learned_at).label("day"), func.count())
        .select_from(UserWord)
        .where(
            UserWord.profile_id == learning_profile.id,
            UserWord.learned_at.is_not(None),
            UserWord.learned_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc),
            UserWord.status.in_(KNOWN_STATUSES),
        )
        .group_by("day")
        .order_by("day")
    )
    series_result = await db.execute(series_stmt)
    counts = {row.day.date(): int(row[1]) for row in series_result.fetchall()}
    learned_series = build_series(counts, start_date, days_total)

    payload = DashboardOut(
        user_id=str(user.id),
        email=user.email,
        avatar_url=user_profile.avatar_url,
        interface_lang=user_profile.interface_lang,
        theme=user_profile.theme or "light",
        native_lang=learning_profile.native_lang,
        target_lang=learning_profile.target_lang,
        days_learning=days_since(learning_profile.created_at or user.created_at, now),
        known_words=known_words,
        learn_today=learn_today,
        learn_available=learn_available,
        review_today=review_today,
        review_available=review_available,
        daily_new_words=settings.daily_new_words,
        daily_review_words=settings.daily_review_words,
        learn_batch_size=settings.learn_batch_size,
        learned_series=learned_series,
    )
    cache_result = await db.execute(
        select(DashboardCache).where(DashboardCache.profile_id == learning_profile.id)
    )
    cache = cache_result.scalar_one_or_none()
    data = jsonable_encoder(payload)
    if cache:
        cache.data = data
        cache.updated_at = now
    else:
        db.add(DashboardCache(profile_id=learning_profile.id, data=data, updated_at=now))
    await db.commit()
    return payload
