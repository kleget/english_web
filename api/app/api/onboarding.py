from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.models import (
    Corpus,
    CorpusWordStat,
    LearningProfile,
    User,
    UserCorpus,
    UserProfile,
    UserSettings,
    UserWord,
    Word,
    Translation,
)
from app.schemas.onboarding import (
    CorpusOut,
    CorpusPreviewOut,
    CorpusPreviewWordOut,
    KnownWordsImportOut,
    KnownWordsImportRequest,
    OnboardingOut,
    OnboardingRequest,
    OnboardingStateCorpusOut,
    OnboardingStateOut,
)

router = APIRouter(tags=["onboarding"])

LANG_CODES = {"ru", "en"}


def normalize_lang(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in LANG_CODES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid language")
    return normalized


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def parse_known_words(text: str) -> tuple[list[tuple[str, str]], int, int]:
    total_lines = 0
    invalid_lines = 0
    entries: list[tuple[str, str]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        total_lines += 1
        if "-" not in line:
            invalid_lines += 1
            continue
        left, right = line.split("-", 1)
        source = left.strip().lower()
        translation = right.strip().lower()
        if not source or not translation:
            invalid_lines += 1
            continue
        entries.append((source, translation))
    return entries, total_lines, invalid_lines


@router.get("/onboarding", response_model=OnboardingStateOut)
async def get_onboarding_state(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStateOut:
    learning_profile = await get_active_learning_profile(user.id, db, require_onboarding=False)
    settings = None
    corpora = []
    if learning_profile is not None:
        settings_result = await db.execute(
            select(UserSettings).where(UserSettings.profile_id == learning_profile.id)
        )
        settings = settings_result.scalar_one_or_none()
        corpora_result = await db.execute(
            select(UserCorpus).where(UserCorpus.profile_id == learning_profile.id)
        )
        corpora = corpora_result.scalars().all()

    return OnboardingStateOut(
        native_lang=learning_profile.native_lang if learning_profile else None,
        target_lang=learning_profile.target_lang if learning_profile else None,
        daily_new_words=settings.daily_new_words if settings else 5,
        daily_review_words=settings.daily_review_words if settings else 10,
        learn_batch_size=settings.learn_batch_size if settings else 5,
        corpora=[
            OnboardingStateCorpusOut(
                corpus_id=item.corpus_id,
                target_word_limit=item.target_word_limit,
                enabled=item.enabled,
            )
            for item in corpora
        ],
        onboarding_done=learning_profile.onboarding_done if learning_profile else False,
    )


@router.get("/corpora/{corpus_id}/preview", response_model=CorpusPreviewOut)
async def preview_corpus(
    corpus_id: int,
    limit: int = 20,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CorpusPreviewOut:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")

    corpus_result = await db.execute(
        select(Corpus.id, Corpus.source_lang, Corpus.target_lang).where(Corpus.id == corpus_id)
    )
    corpus = corpus_result.first()
    if not corpus:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corpus not found")

    stats_result = await db.execute(
        select(CorpusWordStat.word_id, CorpusWordStat.count, CorpusWordStat.rank)
        .where(CorpusWordStat.corpus_id == corpus_id)
        .order_by(CorpusWordStat.rank.asc().nulls_last(), CorpusWordStat.count.desc())
        .limit(limit)
    )
    stats_rows = stats_result.fetchall()
    word_ids = [row.word_id for row in stats_rows]
    if not word_ids:
        return CorpusPreviewOut(
            corpus_id=corpus_id,
            source_lang=corpus.source_lang,
            target_lang=corpus.target_lang,
            words=[],
        )

    word_result = await db.execute(select(Word.id, Word.lemma).where(Word.id.in_(word_ids)))
    word_map = {row.id: row.lemma for row in word_result.fetchall()}

    translation_result = await db.execute(
        select(Translation.word_id, Translation.translation).where(
            Translation.word_id.in_(word_ids),
            Translation.target_lang == corpus.target_lang,
        )
    )
    translation_map: dict[int, list[str]] = defaultdict(list)
    seen: dict[int, set[str]] = defaultdict(set)
    for row in translation_result.fetchall():
        if row.translation in seen[row.word_id]:
            continue
        seen[row.word_id].add(row.translation)
        translation_map[row.word_id].append(row.translation)

    words = [
        CorpusPreviewWordOut(
            word_id=row.word_id,
            lemma=word_map.get(row.word_id, ""),
            translations=translation_map.get(row.word_id, []),
            count=row.count,
            rank=row.rank,
        )
        for row in stats_rows
        if row.word_id in word_map
    ]

    return CorpusPreviewOut(
        corpus_id=corpus_id,
        source_lang=corpus.source_lang,
        target_lang=corpus.target_lang,
        words=words,
    )


@router.get("/corpora", response_model=list[CorpusOut])
async def list_corpora(
    source_lang: str | None = None,
    target_lang: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> list[CorpusOut]:
    source_lang = normalize_lang(source_lang) if source_lang else None
    target_lang = normalize_lang(target_lang) if target_lang else None

    stmt = (
        select(
            Corpus.id,
            Corpus.slug,
            Corpus.name,
            Corpus.source_lang,
            Corpus.target_lang,
            func.count(CorpusWordStat.word_id).label("words_total"),
        )
        .select_from(Corpus)
        .join(CorpusWordStat, CorpusWordStat.corpus_id == Corpus.id, isouter=True)
        .group_by(Corpus.id, Corpus.slug, Corpus.name, Corpus.source_lang, Corpus.target_lang)
        .order_by(Corpus.name)
    )
    if source_lang:
        stmt = stmt.where(Corpus.source_lang == source_lang)
    if target_lang:
        stmt = stmt.where(Corpus.target_lang == target_lang)

    result = await db.execute(stmt)
    return [
        CorpusOut(
            id=row.id,
            slug=row.slug,
            name=row.name,
            source_lang=row.source_lang,
            target_lang=row.target_lang,
            words_total=row.words_total,
        )
        for row in result.fetchall()
    ]


@router.post("/onboarding", response_model=OnboardingOut)
async def apply_onboarding(
    data: OnboardingRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingOut:
    native_lang = normalize_lang(data.native_lang)
    target_lang = normalize_lang(data.target_lang)
    if native_lang == target_lang:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Languages must be different")
    if not data.corpora:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one corpus")
    if data.daily_new_words <= 0 or data.daily_review_words <= 0 or data.learn_batch_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid daily settings")

    corpora_ids = [item.corpus_id for item in data.corpora]
    if len(set(corpora_ids)) != len(corpora_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate corpus ids")

    corpora_rows = await db.execute(
        select(Corpus.id, Corpus.source_lang, Corpus.target_lang).where(Corpus.id.in_(corpora_ids))
    )
    corpora_map = {row.id: row for row in corpora_rows.fetchall()}
    if len(corpora_map) != len(corpora_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown corpus id")
    for corpus_id, corpus in corpora_map.items():
        if corpus.source_lang != native_lang or corpus.target_lang != target_lang:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Corpus {corpus_id} language mismatch",
            )

    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    user_profile = profile_result.scalar_one_or_none()
    if user_profile is None:
        user_profile = UserProfile(user_id=user.id, interface_lang="ru", theme="light")
        db.add(user_profile)

    lp_result = await db.execute(
        select(LearningProfile).where(
            LearningProfile.user_id == user.id,
            LearningProfile.native_lang == native_lang,
            LearningProfile.target_lang == target_lang,
        )
    )
    learning_profile = lp_result.scalar_one_or_none()
    if learning_profile is None:
        learning_profile = LearningProfile(
            user_id=user.id,
            native_lang=native_lang,
            target_lang=target_lang,
            onboarding_done=True,
        )
        db.add(learning_profile)
        await db.flush()
    else:
        learning_profile.onboarding_done = True

    user_profile.active_profile_id = learning_profile.id
    user_profile.native_lang = native_lang
    user_profile.target_lang = target_lang
    user_profile.onboarding_done = True

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.profile_id == learning_profile.id)
    )
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(profile_id=learning_profile.id, user_id=user.id)
        db.add(settings)
    settings.daily_new_words = data.daily_new_words
    settings.daily_review_words = data.daily_review_words
    settings.learn_batch_size = data.learn_batch_size

    await db.execute(delete(UserCorpus).where(UserCorpus.profile_id == learning_profile.id))
    for item in data.corpora:
        if item.target_word_limit < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid target_word_limit")
        db.add(
            UserCorpus(
                profile_id=learning_profile.id,
                user_id=user.id,
                corpus_id=item.corpus_id,
                target_word_limit=item.target_word_limit,
                enabled=item.enabled,
            )
        )

    await db.commit()
    return OnboardingOut()


@router.post("/onboarding/known-words", response_model=KnownWordsImportOut)
async def import_known_words(
    data: KnownWordsImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KnownWordsImportOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)

    entries, total_lines, invalid_lines = parse_known_words(data.text)
    if not entries:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid lines found")

    unique_lemmas = sorted({entry[0] for entry in entries})
    word_id_map: dict[str, int] = {}
    for batch in chunked(unique_lemmas, 1000):
        result = await db.execute(
            select(Word.id, Word.lemma).where(Word.lang == profile.native_lang, Word.lemma.in_(batch))
        )
        for word_id, lemma in result.fetchall():
            word_id_map[lemma] = word_id

    now = datetime.now(timezone.utc)
    rows = [
        {
            "profile_id": profile.id,
            "user_id": user.id,
            "word_id": word_id,
            "status": "known",
            "stage": 0,
            "learned_at": now,
            "next_review_at": now,
        }
        for word_id in word_id_map.values()
    ]
    inserted = 0
    if rows:
        stmt = insert(UserWord).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["profile_id", "word_id"])
        result = await db.execute(stmt)
        inserted = result.rowcount or 0
        await db.commit()

    words_found = len(word_id_map)
    words_missing = len(unique_lemmas) - words_found
    skipped_existing = max(words_found - inserted, 0)

    return KnownWordsImportOut(
        total_lines=total_lines,
        parsed_lines=len(entries),
        invalid_lines=invalid_lines,
        words_found=words_found,
        words_missing=words_missing,
        inserted=inserted,
        skipped_existing=skipped_existing,
    )
