from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, exists, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.auth import get_current_user
from app.core.audit import log_audit_event
from app.core.config import ADMIN_EMAILS
from app.db.session import get_db
from app.models import (
    ContentReport,
    Corpus,
    CorpusWordStat,
    ReviewEvent,
    Translation,
    User,
    UserCustomWord,
    UserWord,
    Word,
)
from app.schemas.admin_content import (
    AdminTranslationOut,
    AdminTranslationUpdate,
    AdminWordOut,
    AdminWordUpdate,
)
from app.schemas.admin_corpora import (
    AdminCorpusOut,
    AdminCorpusTranslationOut,
    AdminCorpusWordOut,
    AdminCorpusWordsOut,
)

router = APIRouter(prefix="/admin/content", tags=["admin"])


def ensure_admin(user: User) -> None:
    if user.email.strip().lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


LANG_CODES = {"ru", "en"}


def normalize_lang(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in LANG_CODES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid language")
    return normalized


@router.get("/corpora", response_model=list[AdminCorpusOut])
async def list_corpora(
    source_lang: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AdminCorpusOut]:
    ensure_admin(user)
    source_lang = normalize_lang(source_lang) if source_lang else None
    stmt = (
        select(
            Corpus.id,
            Corpus.slug,
            Corpus.name,
            func.count(CorpusWordStat.word_id).label("words_total"),
        )
        .select_from(Corpus)
        .join(CorpusWordStat, CorpusWordStat.corpus_id == Corpus.id, isouter=True)
        .join(Word, Word.id == CorpusWordStat.word_id, isouter=True)
        .group_by(Corpus.id, Corpus.slug, Corpus.name)
        .order_by(Corpus.name)
    )
    if source_lang:
        stmt = stmt.where(Word.lang == source_lang)
    result = await db.execute(stmt)
    return [
        AdminCorpusOut(
            id=row.id,
            slug=row.slug,
            name=row.name,
            words_total=row.words_total,
        )
        for row in result.fetchall()
    ]


@router.get("/corpora/{corpus_id}/words", response_model=AdminCorpusWordsOut)
async def list_corpus_words(
    corpus_id: int,
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
    sort: str = "rank",
    order: str | None = None,
    source_lang: str | None = None,
    target_lang: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminCorpusWordsOut:
    ensure_admin(user)
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if offset < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid offset")

    source_lang = normalize_lang(source_lang) if source_lang else None
    target_lang = normalize_lang(target_lang) if target_lang else None
    if not source_lang or not target_lang:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Language required")

    corpus_result = await db.execute(select(Corpus.id).where(Corpus.id == corpus_id))
    corpus = corpus_result.first()
    if not corpus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corpus not found")

    stmt = (
        select(
            Word.id.label("word_id"),
            Word.lemma,
            Word.lang,
            CorpusWordStat.count,
            CorpusWordStat.rank,
        )
        .select_from(CorpusWordStat)
        .join(Word, Word.id == CorpusWordStat.word_id)
        .where(CorpusWordStat.corpus_id == corpus_id, Word.lang == source_lang)
    )

    if query and query.strip():
        like = f"%{query.strip()}%"
        translation_match = exists(
            select(1).where(
                Translation.word_id == Word.id,
                Translation.target_lang == target_lang,
                Translation.translation.ilike(like),
            )
        )
        stmt = stmt.where(or_(Word.lemma.ilike(like), translation_match))

    if sort not in {"rank", "count", "lemma"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid sort")
    order_dir = (order or ("desc" if sort == "count" else "asc")).lower()
    if order_dir not in {"asc", "desc"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order")

    if sort == "count":
        sort_col = CorpusWordStat.count
    elif sort == "lemma":
        sort_col = Word.lemma
    else:
        sort_col = CorpusWordStat.rank

    order_expr = sort_col.desc() if order_dir == "desc" else sort_col.asc()
    if sort == "rank":
        order_expr = order_expr.nulls_last()

    stmt = stmt.order_by(order_expr, CorpusWordStat.count.desc(), Word.lemma.asc())

    total_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total_count = int(total_result.scalar_one() or 0)

    rows = await db.execute(stmt.limit(limit).offset(offset))
    items = rows.fetchall()
    word_ids = [row.word_id for row in items]
    if not word_ids:
        return AdminCorpusWordsOut(total=total_count, items=[])

    translations_result = await db.execute(
        select(Translation.id, Translation.word_id, Translation.translation)
        .where(
            Translation.word_id.in_(word_ids),
            Translation.target_lang == target_lang,
        )
        .order_by(Translation.translation.asc())
    )
    translation_map: dict[int, list[dict]] = {}
    for row in translations_result.fetchall():
        translation_map.setdefault(row.word_id, []).append(
            {
                "id": row.id,
                "translation": row.translation,
            }
        )

    payload = [
        AdminCorpusWordOut(
            word_id=row.word_id,
            lemma=row.lemma,
            lang=row.lang,
            count=row.count,
            rank=row.rank,
            translations=[
                AdminCorpusTranslationOut(**item) for item in translation_map.get(row.word_id, [])
            ],
        )
        for row in items
    ]
    return AdminCorpusWordsOut(total=total_count, items=payload)


STATUS_PRIORITY = {"known": 3, "learned": 2, "new": 1}


def status_rank(value: str | None) -> int:
    if not value:
        return 1
    return STATUS_PRIORITY.get(value, 1)


def is_better_progress(source: UserWord, target: UserWord) -> bool:
    if status_rank(source.status) != status_rank(target.status):
        return status_rank(source.status) > status_rank(target.status)
    if (source.repetitions or 0) != (target.repetitions or 0):
        return (source.repetitions or 0) > (target.repetitions or 0)
    if (source.stage or 0) != (target.stage or 0):
        return (source.stage or 0) > (target.stage or 0)
    return False


def copy_progress(target: UserWord, source: UserWord) -> None:
    target.status = source.status
    target.stage = source.stage
    target.repetitions = source.repetitions
    target.interval_days = source.interval_days
    target.ease_factor = source.ease_factor
    target.learned_at = source.learned_at
    target.last_review_at = source.last_review_at
    target.next_review_at = source.next_review_at
    target.correct_streak = source.correct_streak
    target.wrong_streak = source.wrong_streak


async def merge_words(db: AsyncSession, source_id: int, target_id: int) -> None:
    if source_id == target_id:
        return

    t_src = aliased(Translation)
    t_tgt = aliased(Translation)
    dup_result = await db.execute(
        select(t_src.id, t_tgt.id).join(
            t_tgt,
            (t_src.translation == t_tgt.translation)
            & (t_src.target_lang == t_tgt.target_lang)
            & (t_tgt.word_id == target_id),
        ).where(t_src.word_id == source_id)
    )
    dup_pairs = dup_result.all()
    if dup_pairs:
        for source_translation_id, target_translation_id in dup_pairs:
            await db.execute(
                update(ContentReport)
                .where(ContentReport.translation_id == source_translation_id)
                .values(translation_id=target_translation_id)
            )
        await db.execute(
            delete(Translation).where(Translation.id.in_([row[0] for row in dup_pairs]))
        )
    await db.execute(
        update(Translation).where(Translation.word_id == source_id).values(word_id=target_id)
    )

    stat_target = aliased(CorpusWordStat)
    await db.execute(
        update(CorpusWordStat)
        .where(CorpusWordStat.word_id == source_id)
        .where(
            ~exists(
                select(1).where(
                    (stat_target.corpus_id == CorpusWordStat.corpus_id)
                    & (stat_target.word_id == target_id)
                )
            )
        )
        .values(word_id=target_id)
    )
    stat_source = aliased(CorpusWordStat)
    stat_target = aliased(CorpusWordStat)
    stat_rows = await db.execute(
        select(stat_source, stat_target)
        .join(
            stat_target,
            (stat_target.word_id == target_id)
            & (stat_target.corpus_id == stat_source.corpus_id),
        )
        .where(stat_source.word_id == source_id)
    )
    for source_row, target_row in stat_rows.all():
        target_row.count = max(target_row.count or 0, source_row.count or 0)
        if source_row.rank is not None:
            if target_row.rank is None or source_row.rank < target_row.rank:
                target_row.rank = source_row.rank
        await db.delete(source_row)

    custom_target = aliased(UserCustomWord)
    await db.execute(
        update(UserCustomWord)
        .where(UserCustomWord.word_id == source_id)
        .where(
            ~exists(
                select(1).where(
                    (custom_target.profile_id == UserCustomWord.profile_id)
                    & (custom_target.word_id == target_id)
                    & (custom_target.target_lang == UserCustomWord.target_lang)
                )
            )
        )
        .values(word_id=target_id)
    )
    custom_source = aliased(UserCustomWord)
    custom_target = aliased(UserCustomWord)
    custom_rows = await db.execute(
        select(custom_source)
        .join(
            custom_target,
            (custom_target.word_id == target_id)
            & (custom_target.profile_id == custom_source.profile_id)
            & (custom_target.target_lang == custom_source.target_lang),
        )
        .where(custom_source.word_id == source_id)
    )
    for row in custom_rows.scalars().all():
        await db.delete(row)

    user_target = aliased(UserWord)
    await db.execute(
        update(UserWord)
        .where(UserWord.word_id == source_id)
        .where(
            ~exists(
                select(1).where(
                    (user_target.profile_id == UserWord.profile_id)
                    & (user_target.word_id == target_id)
                )
            )
        )
        .values(word_id=target_id)
    )
    user_source = aliased(UserWord)
    user_target = aliased(UserWord)
    user_rows = await db.execute(
        select(user_source, user_target)
        .join(
            user_target,
            (user_target.profile_id == user_source.profile_id) & (user_target.word_id == target_id),
        )
        .where(user_source.word_id == source_id)
    )
    for source_row, target_row in user_rows.all():
        if is_better_progress(source_row, target_row):
            copy_progress(target_row, source_row)
        await db.delete(source_row)

    await db.execute(
        update(ReviewEvent).where(ReviewEvent.word_id == source_id).values(word_id=target_id)
    )
    await db.execute(
        update(ContentReport).where(ContentReport.word_id == source_id).values(word_id=target_id)
    )

    source_word = await db.get(Word, source_id)
    if source_word:
        await db.delete(source_word)


@router.patch("/words/{word_id}", response_model=AdminWordOut)
async def update_word(
    word_id: int,
    data: AdminWordUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminWordOut:
    ensure_admin(user)
    lemma = (data.lemma or "").strip()
    if not lemma:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Lemma required")

    word = await db.get(Word, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")

    existing = await db.execute(
        select(Word).where(
            Word.lemma == lemma,
            Word.lang == word.lang,
            Word.id != word.id,
        )
    )
    existing_word = existing.scalar_one_or_none()
    if existing_word:
        await merge_words(db, word.id, existing_word.id)
        await db.commit()
        await log_audit_event(
            "admin.word.merge",
            user_id=user.id,
            meta={"source_word_id": word.id, "target_word_id": existing_word.id},
            request=request,
            db=db,
        )
        return AdminWordOut(id=existing_word.id, lemma=existing_word.lemma, lang=existing_word.lang)

    word.lemma = lemma
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word already exists") from exc

    await log_audit_event(
        "admin.word.update",
        user_id=user.id,
        meta={"word_id": word.id},
        request=request,
        db=db,
    )
    return AdminWordOut(id=word.id, lemma=word.lemma, lang=word.lang)


@router.patch("/translations/{translation_id}", response_model=AdminTranslationOut)
async def update_translation(
    translation_id: int,
    data: AdminTranslationUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminTranslationOut:
    ensure_admin(user)
    value = (data.translation or "").strip()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Translation required")

    translation = await db.get(Translation, translation_id)
    if translation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Translation not found")

    existing = await db.execute(
        select(Translation).where(
            Translation.word_id == translation.word_id,
            Translation.target_lang == translation.target_lang,
            Translation.translation == value,
            Translation.id != translation.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Translation already exists")

    translation.translation = value
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Translation already exists") from exc

    await log_audit_event(
        "admin.translation.update",
        user_id=user.id,
        meta={"translation_id": translation.id},
        request=request,
        db=db,
    )
    return AdminTranslationOut(
        id=translation.id,
        word_id=translation.word_id,
        target_lang=translation.target_lang,
        translation=translation.translation,
    )


@router.delete("/words/{word_id}")
async def delete_word(
    word_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ensure_admin(user)
    word = await db.get(Word, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Word not found")

    await db.delete(word)
    await db.commit()

    await log_audit_event(
        "admin.word.delete",
        user_id=user.id,
        meta={"word_id": word_id},
        request=request,
        db=db,
    )
    return {"status": "ok"}


@router.delete("/translations/{translation_id}")
async def delete_translation(
    translation_id: int,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    ensure_admin(user)
    translation = await db.get(Translation, translation_id)
    if translation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Translation not found")

    await db.delete(translation)
    await db.commit()

    await log_audit_event(
        "admin.translation.delete",
        user_id=user.id,
        meta={"translation_id": translation_id},
        request=request,
        db=db,
    )
    return {"status": "ok"}
