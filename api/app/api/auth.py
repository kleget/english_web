import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import User, UserProfile, UserSettings
from app.schemas.auth import LoginRequest, RegisterRequest, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def ensure_lang(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    return value if value in {"ru", "en"} else None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    subject = decode_access_token(token)
    try:
        user_id = uuid.UUID(subject)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register", response_model=TokenOut)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)) -> TokenOut:
    email = normalize_email(data.email)
    interface_lang = ensure_lang(data.interface_lang)
    if not email or not data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password required")
    if len(data.password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too short")
    if interface_lang is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid interface language")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=email, hashed_password=hash_password(data.password))
    db.add(user)
    await db.flush()

    profile = UserProfile(user_id=user.id, interface_lang=interface_lang, theme="light")
    settings = UserSettings(user_id=user.id)
    db.add_all([profile, settings])
    await db.commit()

    token = create_access_token(user.id)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenOut:
    email = normalize_email(data.email)
    if not email or not data.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email and password required")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    interface_lang = ensure_lang(data.interface_lang)
    if interface_lang:
        profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
        profile = profile_result.scalar_one_or_none()
        if profile:
            profile.interface_lang = interface_lang
        else:
            db.add(UserProfile(user_id=user.id, interface_lang=interface_lang, theme="light"))

    settings_result = await db.execute(select(UserSettings).where(UserSettings.user_id == user.id))
    if settings_result.scalar_one_or_none() is None:
        db.add(UserSettings(user_id=user.id))

    await db.commit()
    token = create_access_token(user.id)
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()

    return UserOut(
        id=str(user.id),
        email=user.email,
        interface_lang=profile.interface_lang if profile else None,
        theme=profile.theme if profile else None,
        native_lang=profile.native_lang if profile else None,
        target_lang=profile.target_lang if profile else None,
        onboarding_done=profile.onboarding_done if profile else None,
    )
