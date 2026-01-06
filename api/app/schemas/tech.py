from datetime import datetime
from typing import Any

from pydantic import BaseModel


class NotificationSettingsOut(BaseModel):
    email: str | None
    telegram_chat_id: str | None
    email_enabled: bool
    telegram_enabled: bool
    push_enabled: bool
    review_hour: int
    last_notified_at: datetime | None


class NotificationSettingsUpdate(BaseModel):
    email: str | None = None
    telegram_chat_id: str | None = None
    email_enabled: bool | None = None
    telegram_enabled: bool | None = None
    push_enabled: bool | None = None
    review_hour: int | None = None


class NotificationOutboxOut(BaseModel):
    id: int
    channel: str
    status: str
    payload: dict[str, Any] | None
    scheduled_at: datetime
    sent_at: datetime | None
    error: str | None


class BackgroundJobOut(BaseModel):
    id: int
    job_type: str
    status: str
    payload: dict[str, Any] | None
    result: dict[str, Any] | None
    last_error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class ImportJobRequest(BaseModel):
    sqlite_dir: str | None = None
    map_path: str | None = None


class AuditLogOut(BaseModel):
    id: int
    action: str
    status: str
    meta: dict[str, Any] | None
    ip: str | None
    user_agent: str | None
    created_at: datetime
