from datetime import datetime

from pydantic import BaseModel


class ReportCreate(BaseModel):
    issue_type: str
    message: str | None = None
    word_text: str | None = None
    translation_text: str | None = None
    source: str | None = None
    corpus_id: int | None = None
    word_id: int | None = None
    translation_id: int | None = None


class ReportOut(BaseModel):
    id: int
    issue_type: str
    status: str
    message: str | None
    source: str | None
    word_text: str | None
    translation_text: str | None
    corpus_id: int | None
    corpus_name: str | None
    admin_note: str | None
    created_at: datetime
    updated_at: datetime | None
    resolved_at: datetime | None


class ReportAdminOut(ReportOut):
    user_id: str
    reporter_email: str


class ReportUpdate(BaseModel):
    status: str
    admin_note: str | None = None
