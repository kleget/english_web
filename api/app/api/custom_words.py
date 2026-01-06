from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.models import User, UserCustomWord, UserWord, Word
from app.schemas.custom_words import (
    CustomWordIn,
    CustomWordOut,
    CustomWordsImportOut,
    CustomWordsImportRequest,
)

router = APIRouter(tags=["custom-words"])


def normalize_text(value: str) -> str:
    return " ".join(value.strip().split()).lower()


def chunked(items: list[str], size: int) -> list[list[str]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def parse_import(text: str) -> tuple[list[tuple[str, str]], int, int]:
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
        word = normalize_text(left)
        translation = normalize_text(right)
        if not word or not translation:
            invalid_lines += 1
            continue
        entries.append((word, translation))
    return entries, total_lines, invalid_lines


async def load_profile(user_id, db: AsyncSession):
    return await get_active_learning_profile(user_id, db, require_onboarding=True)


@router.get("/custom-words", response_model=list[CustomWordOut])
async def list_custom_words(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[CustomWordOut]:
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    profile = await load_profile(user.id, db)

    result = await db.execute(
        select(UserCustomWord.word_id, Word.lemma, UserCustomWord.translation, UserCustomWord.created_at)
        .join(Word, Word.id == UserCustomWord.word_id)
        .where(
            UserCustomWord.profile_id == profile.id,
            UserCustomWord.target_lang == profile.target_lang,
            Word.lang == profile.native_lang,
        )
        .order_by(UserCustomWord.created_at.desc(), UserCustomWord.word_id.desc())
        .limit(limit)
    )
    return [
        CustomWordOut(
            word_id=row.word_id,
            word=row.lemma,
            translation=row.translation,
            created_at=row.created_at,
        )
        for row in result.fetchall()
    ]


@router.post("/custom-words", response_model=CustomWordOut)
async def add_custom_word(
    data: CustomWordIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomWordOut:
    profile = await load_profile(user.id, db)

    word = normalize_text(data.word)
    translation = normalize_text(data.translation)
    if not word or not translation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word and translation required")
    if len(word) > 255:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word too long")

    await db.execute(
        insert(Word)
        .values(lemma=word, lang=profile.native_lang)
        .on_conflict_do_nothing(index_elements=["lemma", "lang"])
    )
    word_result = await db.execute(
        select(Word.id).where(Word.lemma == word, Word.lang == profile.native_lang)
    )
    word_id = word_result.scalar_one()

    learned_result = await db.execute(
        select(UserWord.word_id).where(
            UserWord.profile_id == profile.id, UserWord.word_id == word_id
        )
    )
    if learned_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word already learned")

    stmt = insert(UserCustomWord).values(
        profile_id=profile.id,
        user_id=user.id,
        word_id=word_id,
        target_lang=profile.target_lang,
        translation=translation,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["profile_id", "word_id", "target_lang"],
        set_={"translation": stmt.excluded.translation},
    )
    await db.execute(stmt)
    await db.commit()

    row_result = await db.execute(
        select(UserCustomWord).where(
            UserCustomWord.profile_id == profile.id,
            UserCustomWord.word_id == word_id,
            UserCustomWord.target_lang == profile.target_lang,
        )
    )
    row = row_result.scalar_one()

    return CustomWordOut(
        word_id=word_id,
        word=word,
        translation=row.translation,
        created_at=row.created_at,
    )


@router.put("/custom-words/{word_id}", response_model=CustomWordOut)
async def update_custom_word(
    word_id: int,
    data: CustomWordIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomWordOut:
    profile = await load_profile(user.id, db)

    word = normalize_text(data.word)
    translation = normalize_text(data.translation)
    if not word or not translation:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word and translation required")
    if len(word) > 255:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word too long")

    result = await db.execute(
        select(UserCustomWord, Word.lemma)
        .join(Word, Word.id == UserCustomWord.word_id)
        .where(
            UserCustomWord.profile_id == profile.id,
            UserCustomWord.word_id == word_id,
            UserCustomWord.target_lang == profile.target_lang,
            Word.lang == profile.native_lang,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom word not found")

    custom_word = row[0]
    current_lemma = row[1]

    if current_lemma != word:
        learned_result = await db.execute(
            select(UserWord.word_id).where(
                UserWord.profile_id == profile.id,
                UserWord.word_id == custom_word.word_id,
            )
        )
        if learned_result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Word already learned. Delete and add a new one.",
            )

        await db.execute(
            insert(Word)
            .values(lemma=word, lang=profile.native_lang)
            .on_conflict_do_nothing(index_elements=["lemma", "lang"])
        )
        new_word_result = await db.execute(
            select(Word.id).where(Word.lemma == word, Word.lang == profile.native_lang)
        )
        new_word_id = new_word_result.scalar_one()

        learned_new = await db.execute(
            select(UserWord.word_id).where(
                UserWord.profile_id == profile.id,
                UserWord.word_id == new_word_id,
            )
        )
        if learned_new.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word already learned")

        stmt = insert(UserCustomWord).values(
            profile_id=profile.id,
            user_id=user.id,
            word_id=new_word_id,
            target_lang=profile.target_lang,
            translation=translation,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["profile_id", "word_id", "target_lang"],
            set_={"translation": stmt.excluded.translation},
        )
        await db.execute(stmt)
        if new_word_id != custom_word.word_id:
            await db.execute(delete(UserCustomWord).where(UserCustomWord.id == custom_word.id))
        await db.commit()

        updated_result = await db.execute(
            select(UserCustomWord).where(
                UserCustomWord.profile_id == profile.id,
                UserCustomWord.word_id == new_word_id,
                UserCustomWord.target_lang == profile.target_lang,
            )
        )
        updated = updated_result.scalar_one()
        return CustomWordOut(
            word_id=new_word_id,
            word=word,
            translation=updated.translation,
            created_at=updated.created_at,
        )

    custom_word.translation = translation
    await db.commit()
    return CustomWordOut(
        word_id=custom_word.word_id,
        word=word,
        translation=custom_word.translation,
        created_at=custom_word.created_at,
    )


@router.delete("/custom-words/{word_id}")
async def delete_custom_word(
    word_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    profile = await load_profile(user.id, db)
    result = await db.execute(
        delete(UserCustomWord).where(
            UserCustomWord.profile_id == profile.id,
            UserCustomWord.word_id == word_id,
            UserCustomWord.target_lang == profile.target_lang,
        )
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Custom word not found")
    await db.commit()
    return {"deleted": True}


@router.post("/custom-words/import", response_model=CustomWordsImportOut)
async def import_custom_words(
    data: CustomWordsImportRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CustomWordsImportOut:
    profile = await load_profile(user.id, db)
    entries, total_lines, invalid_lines = parse_import(data.text or "")
    if not entries:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No valid lines found")

    entries_map = {}
    for word, translation in entries:
        entries_map[word] = translation

    lemmas = list(entries_map.keys())
    for batch in chunked(lemmas, 1000):
        rows = [{"lemma": lemma, "lang": profile.native_lang} for lemma in batch]
        stmt = insert(Word).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["lemma", "lang"])
        await db.execute(stmt)

    word_id_map: dict[str, int] = {}
    for batch in chunked(lemmas, 1000):
        result = await db.execute(
            select(Word.id, Word.lemma).where(Word.lang == profile.native_lang, Word.lemma.in_(batch))
        )
        for word_id, lemma in result.fetchall():
            word_id_map[lemma] = word_id

    existing_result = await db.execute(
        select(UserCustomWord.word_id, UserCustomWord.translation).where(
            UserCustomWord.profile_id == profile.id,
            UserCustomWord.target_lang == profile.target_lang,
            UserCustomWord.word_id.in_(word_id_map.values()),
        )
    )
    existing_map = {row.word_id: row.translation for row in existing_result.fetchall()}

    rows = []
    inserted = 0
    updated = 0
    skipped = 0
    for lemma, translation in entries_map.items():
        word_id = word_id_map.get(lemma)
        if not word_id:
            continue
        existing_translation = existing_map.get(word_id)
        if existing_translation is None:
            inserted += 1
        elif existing_translation == translation:
            skipped += 1
        else:
            updated += 1
        rows.append(
            {
                "profile_id": profile.id,
                "user_id": user.id,
                "word_id": word_id,
                "target_lang": profile.target_lang,
                "translation": translation,
            }
        )

    if rows:
        stmt = insert(UserCustomWord).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["profile_id", "word_id", "target_lang"],
            set_={"translation": stmt.excluded.translation},
        )
        await db.execute(stmt)

    await db.commit()

    return CustomWordsImportOut(
        total_lines=total_lines,
        parsed_lines=len(entries),
        invalid_lines=invalid_lines,
        inserted=inserted,
        updated=updated,
        skipped=skipped,
    )
