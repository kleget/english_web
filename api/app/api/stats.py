from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.api.study import fetch_user_translation_map, load_profile_settings
from app.db.session import get_db
from app.models import ReviewEvent, User, UserWord, WeakWordsCache, Word
from app.schemas.stats import WeakWordOut, WeakWordsOut

router = APIRouter(tags=["stats"])
DEFAULT_LIMIT = 20
CACHE_TTL_SECONDS = 120


@router.get("/stats/weak-words", response_model=WeakWordsOut)
async def weak_words(
    limit: int = DEFAULT_LIMIT,
    refresh: bool = False,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WeakWordsOut:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")

    profile, _settings = await load_profile_settings(user.id, db)

    now = datetime.now(timezone.utc)
    if not refresh and limit == DEFAULT_LIMIT:
        cache_result = await db.execute(
            select(WeakWordsCache).where(WeakWordsCache.profile_id == profile.id)
        )
        cache = cache_result.scalar_one_or_none()
        if cache and cache.updated_at and now - cache.updated_at <= timedelta(seconds=CACHE_TTL_SECONDS):
            return WeakWordsOut(**cache.data)

    stats_subq = (
        select(
            ReviewEvent.word_id.label("word_id"),
            func.sum(case((ReviewEvent.result == "wrong", 1), else_=0)).label("wrong_count"),
            func.sum(case((ReviewEvent.result == "correct", 1), else_=0)).label("correct_count"),
        )
        .where(ReviewEvent.profile_id == profile.id)
        .group_by(ReviewEvent.word_id)
        .subquery()
    )

    total_result = await db.execute(select(func.count()).select_from(stats_subq))
    total_count = int(total_result.scalar_one() or 0)

    stmt = (
        select(
            stats_subq.c.word_id,
            stats_subq.c.wrong_count,
            stats_subq.c.correct_count,
            Word.lemma,
            UserWord.learned_at,
            UserWord.next_review_at,
        )
        .select_from(stats_subq)
        .join(Word, Word.id == stats_subq.c.word_id)
        .join(
            UserWord,
            and_(UserWord.profile_id == profile.id, UserWord.word_id == stats_subq.c.word_id),
        )
        .order_by(stats_subq.c.wrong_count.desc(), stats_subq.c.correct_count.asc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    word_ids = [row.word_id for row in rows]
    translation_map = await fetch_user_translation_map(profile.id, word_ids, profile.target_lang, db)

    results = []
    for row in rows:
        attempts = (row.correct_count or 0) + (row.wrong_count or 0)
        accuracy = round((row.correct_count or 0) / attempts, 3) if attempts else 0.0
        results.append(
            WeakWordOut(
                word_id=row.word_id,
                word=row.lemma,
                translations=translation_map.get(row.word_id, []),
                wrong_count=int(row.wrong_count or 0),
                correct_count=int(row.correct_count or 0),
                accuracy=accuracy,
                learned_at=row.learned_at,
                next_review_at=row.next_review_at,
            )
        )

    payload = WeakWordsOut(total=total_count, items=results)
    if limit == DEFAULT_LIMIT:
        cache_result = await db.execute(
            select(WeakWordsCache).where(WeakWordsCache.profile_id == profile.id)
        )
        cache = cache_result.scalar_one_or_none()
        data = jsonable_encoder(payload)
        if cache:
            cache.data = data
            cache.updated_at = now
        else:
            db.add(WeakWordsCache(profile_id=profile.id, data=data, updated_at=now))
        await db.commit()
    return payload
