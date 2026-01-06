import hashlib
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import log_audit_event
from app.core.config import (
    API_BASE_URL,
    APP_BASE_URL,
    ADMIN_EMAILS,
    JWT_SECRET,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TLS,
    SMTP_USER,
)
from app.core.security import create_access_token, decode_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models import AuthToken, LearningProfile, User, UserProfile
from app.schemas.auth import (
    EmailRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenOut,
    UserOut,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()
VERIFY_TOKEN_HOURS = 24
RESET_TOKEN_HOURS = 2


def hash_token(token: str) -> str:
    value = f"{token}.{JWT_SECRET}".encode("utf-8")
    return hashlib.sha256(value).hexdigest()


def build_link(base_url: str, path: str, token: str) -> str:
    base = base_url.rstrip("/")
    return f"{base}{path}?token={token}"


def build_verify_link(token: str) -> str:
    return build_link(API_BASE_URL, "/auth/verify", token)


def build_reset_link(token: str) -> str:
    return build_link(APP_BASE_URL, "/auth/reset", token)


def ensure_smtp_configured() -> None:
    if not SMTP_HOST or not SMTP_FROM:
        raise RuntimeError("SMTP not configured")


def send_email_message(to_email: str, subject: str, body: str) -> None:
    ensure_smtp_configured()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message.set_content(body)
    if SMTP_TLS:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)


async def send_email_async(to_email: str, subject: str, body: str) -> None:
    await run_in_threadpool(send_email_message, to_email, subject, body)


def build_verify_email(link: str) -> tuple[str, str]:
    subject = "Confirm your email"
    body = (
        "Confirm your email address:\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this message.\n\n"
        "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0435 \u043f\u043e\u0447\u0442\u0443:\n"
        f"{link}\n\n"
        "\u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u043d\u0435 \u0432\u0430\u0448 \u0437\u0430\u043f\u0440\u043e\u0441, \u043f\u0440\u043e\u0441\u0442\u043e \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0439\u0442\u0435."
    )
    return subject, body


def build_reset_email(link: str) -> tuple[str, str]:
    subject = "Password reset"
    body = (
        "Reset your password:\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this message.\n\n"
        "\u0421\u0431\u0440\u043e\u0441 \u043f\u0430\u0440\u043e\u043b\u044f:\n"
        f"{link}\n\n"
        "\u0415\u0441\u043b\u0438 \u044d\u0442\u043e \u043d\u0435 \u0432\u0430\u0448 \u0437\u0430\u043f\u0440\u043e\u0441, \u043f\u0440\u043e\u0441\u0442\u043e \u0438\u0433\u043d\u043e\u0440\u0438\u0440\u0443\u0439\u0442\u0435."
    )
    return subject, body


async def create_auth_token(
    db: AsyncSession,
    user_id: uuid.UUID,
    purpose: str,
    ttl_hours: int,
) -> str:
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
    db.add(
        AuthToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    return raw_token


async def consume_auth_token(db: AsyncSession, token: str, purpose: str) -> AuthToken:
    token_value = token.strip()
    if not token_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token required")
    token_hash = hash_token(token_value)
    result = await db.execute(
        select(AuthToken).where(AuthToken.token_hash == token_hash, AuthToken.purpose == purpose)
    )
    auth_token = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if not auth_token or auth_token.used_at or auth_token.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")
    auth_token.used_at = now
    return auth_token


async def verify_email_token(db: AsyncSession, token: str) -> User:
    token_value = token.strip()
    if not token_value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token required")
    token_hash = hash_token(token_value)
    result = await db.execute(
        select(AuthToken).where(AuthToken.token_hash == token_hash, AuthToken.purpose == "verify")
    )
    auth_token = result.scalar_one_or_none()
    if not auth_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.id == auth_token.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    now = datetime.now(timezone.utc)
    if user.email_verified_at is not None:
        if auth_token.used_at is None:
            auth_token.used_at = now
            await db.commit()
        return user

    if auth_token.expires_at <= now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    if auth_token.used_at is None:
        auth_token.used_at = now
    user.email_verified_at = now
    await db.commit()
    return user


def normalize_email(email: str) -> str:
    return email.strip().lower()


def ensure_lang(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip().lower()
    return value if value in {"ru", "en"} else None


async def get_active_learning_profile(
    user_id: uuid.UUID,
    db: AsyncSession,
    require_onboarding: bool = True,
) -> LearningProfile | None:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user_id))
    user_profile = profile_result.scalar_one_or_none()
    if user_profile is None or user_profile.active_profile_id is None:
        if require_onboarding:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")
        return None

    lp_result = await db.execute(
        select(LearningProfile).where(
            LearningProfile.id == user_profile.active_profile_id,
            LearningProfile.user_id == user_id,
        )
    )
    learning_profile = lp_result.scalar_one_or_none()
    if learning_profile is None:
        if require_onboarding:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")
        return None
    if require_onboarding and not learning_profile.onboarding_done:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Onboarding required")
    return learning_profile


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
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User inactive")
    if user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email not verified")
    return user


@router.post("/register", response_model=TokenOut)
async def register(
    data: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
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
    db.add(profile)

    verify_token = await create_auth_token(db, user.id, "verify", VERIFY_TOKEN_HOURS)
    verify_link = build_verify_link(verify_token)
    subject, body = build_verify_email(verify_link)
    try:
        await send_email_async(email, subject, body)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Email delivery failed") from exc

    await db.commit()

    await log_audit_event("auth.register", user_id=user.id, request=request, db=db)
    token = create_access_token(user.id)
    return TokenOut(access_token=token, email_verified=False)


@router.post("/login", response_model=TokenOut)
async def login(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
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

    await db.commit()
    await log_audit_event("auth.login", user_id=user.id, request=request, db=db)
    token = create_access_token(user.id)
    return TokenOut(access_token=token, email_verified=user.email_verified_at is not None)


@router.post("/request-verify")
async def request_verify(
    data: EmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    email = normalize_email(data.email)
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email required")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.email_verified_at is not None:
        return {"status": "ok"}

    verify_token = await create_auth_token(db, user.id, "verify", VERIFY_TOKEN_HOURS)
    verify_link = build_verify_link(verify_token)
    subject, body = build_verify_email(verify_link)
    try:
        await send_email_async(email, subject, body)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Email delivery failed") from exc

    await db.commit()
    await log_audit_event("auth.verify.request", user_id=user.id, request=request, db=db)
    return {"status": "ok"}


@router.post("/verify")
async def verify_email(
    data: VerifyEmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    user = await verify_email_token(db, data.token)
    await log_audit_event("auth.verify", user_id=user.id, request=request, db=db)
    return {"status": "ok"}


@router.get("/verify")
async def verify_email_link(
    request: Request,
    token: str = "",
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    status_value = "ok"
    try:
        user = await verify_email_token(db, token)
        await log_audit_event("auth.verify.link", user_id=user.id, request=request, db=db)
    except HTTPException:
        status_value = "error"
    target = f"{APP_BASE_URL.rstrip('/')}/auth/verify?status={status_value}"
    return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)


@router.post("/request-password-reset")
async def request_password_reset(
    data: EmailRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    email = normalize_email(data.email)
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email required")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return {"status": "ok"}

    reset_token = await create_auth_token(db, user.id, "reset", RESET_TOKEN_HOURS)
    reset_link = build_reset_link(reset_token)
    subject, body = build_reset_email(reset_link)
    try:
        await send_email_async(email, subject, body)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Email delivery failed") from exc

    await db.commit()
    await log_audit_event("auth.reset.request", user_id=user.id, request=request, db=db)
    return {"status": "ok"}


@router.post("/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if len(data.new_password) < 6:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password too short")

    auth_token = await consume_auth_token(db, data.token, "reset")
    result = await db.execute(select(User).where(User.id == auth_token.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user.hashed_password = hash_password(data.new_password)
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)

    await db.commit()
    await log_audit_event("auth.reset", user_id=user.id, request=request, db=db)
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
async def me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))
    profile = profile_result.scalar_one_or_none()
    learning_profile = await get_active_learning_profile(user.id, db, require_onboarding=False)

    return UserOut(
        id=str(user.id),
        email=user.email,
        interface_lang=profile.interface_lang if profile else None,
        theme=profile.theme if profile else None,
        email_verified=user.email_verified_at is not None,
        is_admin=user.email.strip().lower() in ADMIN_EMAILS,
        native_lang=learning_profile.native_lang if learning_profile else None,
        target_lang=learning_profile.target_lang if learning_profile else None,
        onboarding_done=learning_profile.onboarding_done if learning_profile else None,
    )
