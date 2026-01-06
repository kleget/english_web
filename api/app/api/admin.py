from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_current_user
from app.core.audit import log_audit_event
from app.core.config import ADMIN_EMAILS
from app.db.session import get_db
from app.models import (
    AuditLog,
    BackgroundJob,
    ContentReport,
    Corpus,
    LearningProfile,
    NotificationOutbox,
    User,
    UserProfile,
)
from app.schemas.admin import AdminAuditOut, AdminSummaryOut, AdminUserOut, AdminUserUpdate

router = APIRouter(prefix="/admin", tags=["admin"])


def is_admin(user: User) -> bool:
    return user.email.strip().lower() in ADMIN_EMAILS


def ensure_admin(user: User) -> None:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


def ensure_lang(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in {"ru", "en"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid interface language")
    return normalized


def ensure_theme(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized not in {"light", "dark"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid theme")
    return normalized


@router.get("/summary", response_model=AdminSummaryOut)
async def get_admin_summary(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminSummaryOut:
    ensure_admin(user)

    total_users = int(await db.scalar(select(func.count(User.id))) or 0)
    active_users = int(await db.scalar(select(func.count(User.id)).where(User.is_active.is_(True))) or 0)
    verified_users = int(
        await db.scalar(select(func.count(User.id)).where(User.email_verified_at.is_not(None))) or 0
    )
    onboarded_users = int(
        await db.scalar(select(func.count(UserProfile.user_id)).where(UserProfile.onboarding_done.is_(True))) or 0
    )
    learning_profiles = int(await db.scalar(select(func.count(LearningProfile.id))) or 0)
    corpora_total = int(await db.scalar(select(func.count(Corpus.id))) or 0)

    report_rows = await db.execute(
        select(ContentReport.status, func.count(ContentReport.id)).group_by(ContentReport.status)
    )
    report_map = {row.status: row.count for row in report_rows.fetchall()}

    job_rows = await db.execute(
        select(BackgroundJob.status, func.count(BackgroundJob.id)).group_by(BackgroundJob.status)
    )
    job_map = {row.status: row.count for row in job_rows.fetchall()}

    notification_rows = await db.execute(
        select(NotificationOutbox.status, func.count(NotificationOutbox.id)).group_by(NotificationOutbox.status)
    )
    notification_map = {row.status: row.count for row in notification_rows.fetchall()}

    return AdminSummaryOut(
        total_users=total_users,
        active_users=active_users,
        verified_users=verified_users,
        onboarded_users=onboarded_users,
        learning_profiles=learning_profiles,
        corpora=corpora_total,
        reports_open=int(report_map.get("open", 0) or 0),
        reports_in_progress=int(report_map.get("in_progress", 0) or 0),
        reports_resolved=int(report_map.get("resolved", 0) or 0),
        reports_rejected=int(report_map.get("rejected", 0) or 0),
        jobs_pending=int(job_map.get("pending", 0) or 0),
        jobs_running=int(job_map.get("running", 0) or 0),
        jobs_done=int(job_map.get("done", 0) or 0),
        jobs_failed=int(job_map.get("failed", 0) or 0),
        notifications_pending=int(notification_map.get("pending", 0) or 0),
        notifications_sent=int(notification_map.get("sent", 0) or 0),
        notifications_failed=int(notification_map.get("failed", 0) or 0),
    )


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    query: str | None = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserOut]:
    ensure_admin(user)
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if offset < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid offset")

    stmt = (
        select(User, UserProfile)
        .join(UserProfile, UserProfile.user_id == User.id, isouter=True)
        .order_by(User.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if query:
        stmt = stmt.where(User.email.ilike(f"%{query.strip()}%"))

    result = await db.execute(stmt)
    rows = result.fetchall()

    items: list[AdminUserOut] = []
    for user_row, profile in rows:
        items.append(
            AdminUserOut(
                id=str(user_row.id),
                email=user_row.email,
                is_active=user_row.is_active,
                email_verified=user_row.email_verified_at is not None,
                is_admin=user_row.email.strip().lower() in ADMIN_EMAILS,
                created_at=user_row.created_at,
                interface_lang=profile.interface_lang if profile else None,
                theme=profile.theme if profile else None,
                onboarding_done=profile.onboarding_done if profile else None,
                native_lang=profile.native_lang if profile else None,
                target_lang=profile.target_lang if profile else None,
            )
        )
    return items


@router.patch("/users/{user_id}", response_model=AdminUserOut)
async def update_user(
    user_id: uuid.UUID,
    data: AdminUserUpdate,
    admin_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AdminUserOut:
    ensure_admin(admin_user)

    result = await db.execute(select(User).where(User.id == user_id))
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if data.is_active is not None:
        if target_user.id == admin_user.id and not data.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate own account")
        target_user.is_active = data.is_active

    if data.email_verified is not None:
        if target_user.id == admin_user.id and not data.email_verified:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot unverify own account")
        target_user.email_verified_at = (
            datetime.now(timezone.utc) if data.email_verified else None
        )

    interface_lang = ensure_lang(data.interface_lang)
    theme = ensure_theme(data.theme)
    profile = None
    if interface_lang is not None or theme is not None:
        profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == target_user.id))
        profile = profile_result.scalar_one_or_none()
        if profile is None:
            profile = UserProfile(user_id=target_user.id, interface_lang="ru", theme="light")
            db.add(profile)
        if interface_lang is not None:
            profile.interface_lang = interface_lang
        if theme is not None:
            profile.theme = theme

    await db.commit()

    await log_audit_event(
        "admin.user.update",
        user_id=admin_user.id,
        meta={
            "target_user_id": str(target_user.id),
            "is_active": data.is_active,
            "email_verified": data.email_verified,
            "interface_lang": interface_lang,
            "theme": theme,
        },
        db=db,
    )

    if profile is None:
        profile_result = await db.execute(select(UserProfile).where(UserProfile.user_id == target_user.id))
        profile = profile_result.scalar_one_or_none()

    return AdminUserOut(
        id=str(target_user.id),
        email=target_user.email,
        is_active=target_user.is_active,
        email_verified=target_user.email_verified_at is not None,
        is_admin=target_user.email.strip().lower() in ADMIN_EMAILS,
        created_at=target_user.created_at,
        interface_lang=profile.interface_lang if profile else None,
        theme=profile.theme if profile else None,
        onboarding_done=profile.onboarding_done if profile else None,
        native_lang=profile.native_lang if profile else None,
        target_lang=profile.target_lang if profile else None,
    )


@router.get("/audit", response_model=list[AdminAuditOut])
async def list_audit_logs(
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AdminAuditOut]:
    ensure_admin(user)
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")

    result = await db.execute(
        select(AuditLog, User.email)
        .join(User, User.id == AuditLog.user_id, isouter=True)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    return [
        AdminAuditOut(
            id=log.id,
            user_id=str(log.user_id) if log.user_id else None,
            user_email=email,
            action=log.action,
            status=log.status,
            meta=log.meta,
            ip=log.ip,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log, email in result.fetchall()
    ]
