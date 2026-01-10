from datetime import datetime

from pydantic import BaseModel


class SupportTicketCreate(BaseModel):
    subject: str
    message: str
    category: str | None = None


class SupportTicketOut(BaseModel):
    id: int
    subject: str
    message: str
    category: str | None
    status: str
    admin_reply: str | None
    created_at: datetime
    updated_at: datetime | None
    closed_at: datetime | None


class SupportTicketAdminOut(SupportTicketOut):
    user_id: str
    reporter_email: str


class SupportTicketUpdate(BaseModel):
    status: str
    admin_reply: str | None = None
