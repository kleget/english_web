from datetime import datetime
from pydantic import BaseModel


class AdminSummaryOut(BaseModel):
    total_users: int
    active_users: int
    verified_users: int
    onboarded_users: int
    learning_profiles: int
    corpora: int
    reports_open: int
    reports_in_progress: int
    reports_resolved: int
    reports_rejected: int
    jobs_pending: int
    jobs_running: int
    jobs_done: int
    jobs_failed: int
    notifications_pending: int
    notifications_sent: int
    notifications_failed: int


class AdminUserOut(BaseModel):
    id: str
    email: str
    is_active: bool
    email_verified: bool
    is_admin: bool
    created_at: datetime
    interface_lang: str | None = None
    theme: str | None = None
    onboarding_done: bool | None = None
    native_lang: str | None = None
    target_lang: str | None = None


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    email_verified: bool | None = None
    interface_lang: str | None = None
    theme: str | None = None


class AdminAuditOut(BaseModel):
    id: int
    user_id: str | None = None
    user_email: str | None = None
    action: str
    status: str
    meta: dict | None = None
    ip: str | None = None
    user_agent: str | None = None
    created_at: datetime
