from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.db.session import get_db
from app.models import User, UserProfile
from app.schemas.profile import ProfileOut, ProfileUpdateRequest

router = APIRouter(prefix="/profile", tags=["profile"])

LANG_CODES = {"ru", "en"}
THEMES = {"light", "dark"}


def normalize_lang(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    if value not in LANG_CODES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid interface language")
    return value


def normalize_theme(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    if value not in THEMES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid theme")
    return value


@router.get("", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileOut:
    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user.id, interface_lang="ru", theme="light")
        db.add(profile)
        await db.commit()
    return ProfileOut(interface_lang=profile.interface_lang, theme=profile.theme or "light")


@router.put("", response_model=ProfileOut)
async def update_profile(
    data: ProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileOut:
    interface_lang = normalize_lang(data.interface_lang)
    theme = normalize_theme(data.theme)
    if interface_lang is None and theme is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to update")

    result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = UserProfile(user_id=user.id, interface_lang="ru", theme="light")
        db.add(profile)

    if interface_lang:
        profile.interface_lang = interface_lang
    if theme:
        profile.theme = theme

    await db.commit()
    return ProfileOut(interface_lang=profile.interface_lang, theme=profile.theme or "light")
