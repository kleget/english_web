from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models import CorpusWordStat, User, UserCorpus, UserProfile, UserSettings, UserWord
from app.schemas.dashboard import DashboardOut, LearnedSeriesPoint

router = APIRouter(tags=["dashboard"])

KNOWN_STATUSES = ("known", "learned")


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


async def count_available_new_words(user_id, db: AsyncSession) -> int:
    stmt = (
        select(func.count(func.distinct(CorpusWordStat.word_id)))
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .outerjoin(
            UserWord,
            and_(UserWord.user_id == user_id, UserWord.word_id == CorpusWordStat.word_id),
        )
        .where(UserCorpus.user_id == user_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


@router.get("/dashboard", response_model=DashboardOut)
async def get_dashboard(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardOut:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    if not profile or not profile.onboarding_done:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")

    settings_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        await db.commit()

    now = datetime.now(timezone.utc)

    known_stmt = (
        select(func.count())
        .select_from(UserWord)
        .where(UserWord.user_id == user.id, UserWord.status.in_(KNOWN_STATUSES))
    )
    known_result = await db.execute(known_stmt)
    known_words = int(known_result.scalar() or 0)

    review_stmt = (
        select(func.count())
        .select_from(UserWord)
        .where(
            UserWord.user_id == user.id,
            UserWord.next_review_at.is_not(None),
            UserWord.next_review_at <= now,
        )
    )
    review_result = await db.execute(review_stmt)
    review_available = int(review_result.scalar() or 0)

    learn_available = await count_available_new_words(user.id, db)
    learn_today = min(settings.daily_new_words, learn_available)
    review_today = min(settings.daily_review_words, review_available)

    days_total = 14
    start_date = (now - timedelta(days=days_total - 1)).date()
    series_stmt = (
        select(func.date_trunc("day", UserWord.learned_at).label("day"), func.count())
        .select_from(UserWord)
        .where(
            UserWord.user_id == user.id,
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

    return DashboardOut(
        user_id=str(user.id),
        email=user.email,
        avatar_url=profile.avatar_url,
        interface_lang=profile.interface_lang,
        theme=profile.theme or "light",
        native_lang=profile.native_lang,
        target_lang=profile.target_lang,
        days_learning=days_since(user.created_at, now),
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
