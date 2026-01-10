from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.audit import log_audit_event
from app.core.config import ADMIN_EMAILS
from app.db.session import get_db
from app.models import Translation, User, Word
from app.schemas.admin_content import (
    AdminTranslationOut,
    AdminTranslationUpdate,
    AdminWordOut,
    AdminWordUpdate,
)

router = APIRouter(prefix="/admin/content", tags=["admin"])


def ensure_admin(user: User) -> None:
    if user.email.strip().lower() not in ADMIN_EMAILS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


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
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word already exists")

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
