from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.models import (
    AuditLog,
    BackgroundJob,
    NotificationOutbox,
    NotificationSettings,
    User,
)
from app.schemas.tech import (
    AuditLogOut,
    BackgroundJobOut,
    ImportJobRequest,
    NotificationOutboxOut,
    NotificationSettingsOut,
    NotificationSettingsUpdate,
)

router = APIRouter(prefix="/tech", tags=["tech"])


def build_job_out(job: BackgroundJob) -> BackgroundJobOut:
    return BackgroundJobOut(
        id=job.id,
        job_type=job.job_type,
        status=job.status,
        payload=job.payload,
        result=job.result,
        last_error=job.last_error,
        created_at=job.created_at,
        started_at=job.started_at,
        finished_at=job.finished_at,
    )


async def ensure_notification_settings(
    user_id, profile_id, db: AsyncSession
) -> NotificationSettings:
    result = await db.execute(
        select(NotificationSettings).where(NotificationSettings.profile_id == profile_id)
    )
    settings = result.scalar_one_or_none()
    if settings:
        return settings
    settings = NotificationSettings(profile_id=profile_id, user_id=user_id, review_hour=9)
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def enqueue_job(
    job_type: str,
    user_id,
    profile_id,
    payload: dict | None,
    db: AsyncSession,
) -> BackgroundJob:
    job = BackgroundJob(
        job_type=job_type,
        status="pending",
        payload=payload,
        user_id=user_id,
        profile_id=profile_id,
        run_after=datetime.now(timezone.utc),
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.get("/notifications", response_model=NotificationSettingsOut)
async def get_notification_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingsOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    settings = await ensure_notification_settings(user.id, profile.id, db)
    return NotificationSettingsOut(
        email=settings.email,
        telegram_chat_id=settings.telegram_chat_id,
        email_enabled=settings.email_enabled,
        telegram_enabled=settings.telegram_enabled,
        push_enabled=settings.push_enabled,
        review_hour=settings.review_hour,
        last_notified_at=settings.last_notified_at,
    )


@router.put("/notifications", response_model=NotificationSettingsOut)
async def update_notification_settings(
    data: NotificationSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationSettingsOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    settings = await ensure_notification_settings(user.id, profile.id, db)

    if data.email is not None:
        settings.email = data.email.strip() or None
    if data.telegram_chat_id is not None:
        settings.telegram_chat_id = data.telegram_chat_id.strip() or None
    if data.email_enabled is not None:
        settings.email_enabled = data.email_enabled
    if data.telegram_enabled is not None:
        settings.telegram_enabled = data.telegram_enabled
    if data.push_enabled is not None:
        settings.push_enabled = data.push_enabled
    if data.review_hour is not None:
        if data.review_hour < 0 or data.review_hour > 23:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid hour")
        settings.review_hour = data.review_hour

    settings.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(settings)

    return NotificationSettingsOut(
        email=settings.email,
        telegram_chat_id=settings.telegram_chat_id,
        email_enabled=settings.email_enabled,
        telegram_enabled=settings.telegram_enabled,
        push_enabled=settings.push_enabled,
        review_hour=settings.review_hour,
        last_notified_at=settings.last_notified_at,
    )


@router.get("/notifications/outbox", response_model=list[NotificationOutboxOut])
async def list_notification_outbox(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOutboxOut]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    result = await db.execute(
        select(NotificationOutbox)
        .where(NotificationOutbox.profile_id == profile.id)
        .order_by(NotificationOutbox.created_at.desc())
        .limit(limit)
    )
    return [
        NotificationOutboxOut(
            id=row.id,
            channel=row.channel,
            status=row.status,
            payload=row.payload,
            scheduled_at=row.scheduled_at,
            sent_at=row.sent_at,
            error=row.error,
        )
        for row in result.scalars().all()
    ]


@router.post("/jobs/refresh-stats", response_model=BackgroundJobOut)
async def schedule_refresh_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    job = await enqueue_job("refresh_stats", user.id, profile.id, {}, db)
    return build_job_out(job)


@router.post("/jobs/report", response_model=BackgroundJobOut)
async def schedule_report(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    job = await enqueue_job("generate_report", user.id, profile.id, {}, db)
    return build_job_out(job)


@router.post("/jobs/notifications", response_model=BackgroundJobOut)
async def schedule_notifications(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    job = await enqueue_job("send_review_notifications", user.id, profile.id, {}, db)
    return build_job_out(job)


@router.post("/jobs/import", response_model=BackgroundJobOut)
async def schedule_import(
    data: ImportJobRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BackgroundJobOut:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    payload = {}
    if data.sqlite_dir:
        payload["sqlite_dir"] = data.sqlite_dir
    if data.map_path:
        payload["map_path"] = data.map_path
    job = await enqueue_job("import_words", user.id, profile.id, payload, db)
    return build_job_out(job)


@router.get("/jobs", response_model=list[BackgroundJobOut])
async def list_jobs(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BackgroundJobOut]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    result = await db.execute(
        select(BackgroundJob)
        .where(BackgroundJob.user_id == user.id)
        .order_by(BackgroundJob.created_at.desc())
        .limit(limit)
    )
    return [build_job_out(job) for job in result.scalars().all()]


@router.get("/audit", response_model=list[AuditLogOut])
async def list_audit_logs(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AuditLogOut]:
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.user_id == user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return [
        AuditLogOut(
            id=row.id,
            action=row.action,
            status=row.status,
            meta=row.meta,
            ip=row.ip,
            user_agent=row.user_agent,
            created_at=row.created_at,
        )
        for row in result.scalars().all()
    ]
