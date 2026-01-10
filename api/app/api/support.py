from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.core.audit import log_audit_event
from app.core.config import ADMIN_EMAILS
from app.db.session import get_db
from app.models import SupportTicket, User
from app.schemas.support import (
    SupportTicketAdminOut,
    SupportTicketCreate,
    SupportTicketOut,
    SupportTicketUpdate,
)

router = APIRouter(prefix="/support", tags=["support"])

CATEGORY_TYPES = {"account", "billing", "technical", "bug", "feature", "other"}
STATUS_TYPES = {"open", "in_progress", "answered", "closed"}


def is_admin(user: User) -> bool:
    return user.email.strip().lower() in ADMIN_EMAILS


def build_ticket_out(ticket: SupportTicket) -> SupportTicketOut:
    return SupportTicketOut(
        id=ticket.id,
        subject=ticket.subject,
        message=ticket.message,
        category=ticket.category,
        status=ticket.status,
        admin_reply=ticket.admin_reply,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        closed_at=ticket.closed_at,
    )


def build_admin_ticket_out(ticket: SupportTicket, reporter_email: str) -> SupportTicketAdminOut:
    return SupportTicketAdminOut(
        id=ticket.id,
        subject=ticket.subject,
        message=ticket.message,
        category=ticket.category,
        status=ticket.status,
        admin_reply=ticket.admin_reply,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        closed_at=ticket.closed_at,
        user_id=str(ticket.user_id),
        reporter_email=reporter_email,
    )


def normalize_category(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if not normalized:
        return None
    if normalized not in CATEGORY_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid category")
    return normalized


def normalize_status(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in STATUS_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    return normalized


@router.post("", response_model=SupportTicketOut)
async def create_ticket(
    data: SupportTicketCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketOut:
    subject = data.subject.strip() if data.subject else ""
    message = data.message.strip() if data.message else ""
    if len(subject) < 3:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject too short")
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message required")

    category = normalize_category(data.category)
    profile = await get_active_learning_profile(user.id, db, require_onboarding=False)
    profile_id = profile.id if profile else None

    ticket = SupportTicket(
        user_id=user.id,
        profile_id=profile_id,
        category=category,
        subject=subject,
        message=message,
        status="open",
        updated_at=datetime.now(timezone.utc),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    await log_audit_event(
        "support.create",
        user_id=user.id,
        meta={"ticket_id": ticket.id},
        request=request,
        db=db,
    )

    return build_ticket_out(ticket)


@router.get("", response_model=list[SupportTicketOut])
async def list_tickets(
    limit: int = 20,
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SupportTicketOut]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if status_filter:
        status_filter = normalize_status(status_filter)

    stmt = (
        select(SupportTicket)
        .where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(SupportTicket.status == status_filter)
    result = await db.execute(stmt)
    return [build_ticket_out(item) for item in result.scalars().all()]


@router.get("/admin", response_model=list[SupportTicketAdminOut])
async def list_admin_tickets(
    limit: int = 50,
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SupportTicketAdminOut]:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if status_filter:
        status_filter = normalize_status(status_filter)

    stmt = (
        select(SupportTicket, User.email)
        .join(User, User.id == SupportTicket.user_id)
        .order_by(SupportTicket.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(SupportTicket.status == status_filter)

    result = await db.execute(stmt)
    return [
        build_admin_ticket_out(ticket, email or "-") for ticket, email in result.fetchall()
    ]


@router.patch("/admin/{ticket_id}", response_model=SupportTicketAdminOut)
async def update_ticket(
    ticket_id: int,
    data: SupportTicketUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SupportTicketAdminOut:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    status_value = normalize_status(data.status)

    ticket = await db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")

    ticket.status = status_value
    ticket.admin_reply = data.admin_reply.strip() if data.admin_reply else None
    ticket.updated_at = datetime.now(timezone.utc)
    if status_value in {"closed", "answered"}:
        ticket.closed_at = datetime.now(timezone.utc)
    else:
        ticket.closed_at = None

    await db.commit()
    await db.refresh(ticket)

    await log_audit_event(
        "support.update",
        user_id=user.id,
        meta={"ticket_id": ticket.id, "status": ticket.status},
        request=request,
        db=db,
    )

    reporter = await db.get(User, ticket.user_id)
    reporter_email = reporter.email if reporter else "-"
    return build_admin_ticket_out(ticket, reporter_email)
