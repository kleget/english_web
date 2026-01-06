from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import Request

from app.db.session import AsyncSessionLocal
from app.models import AuditLog


async def log_audit_event(
    action: str,
    user_id=None,
    status: str = "success",
    meta: dict[str, Any] | None = None,
    request: Request | None = None,
    db=None,
) -> None:
    session = db or AsyncSessionLocal()
    owns_session = db is None
    try:
        ip = None
        user_agent = None
        if request is not None:
            ip = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
        entry = AuditLog(
            user_id=user_id,
            action=action,
            status=status,
            meta=meta,
            ip=ip,
            user_agent=user_agent,
            created_at=datetime.now(timezone.utc),
        )
        session.add(entry)
        await session.commit()
    except Exception:
        if owns_session:
            await session.rollback()
    finally:
        if owns_session:
            await session.close()
