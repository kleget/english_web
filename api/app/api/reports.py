from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.core.audit import log_audit_event
from app.core.config import ADMIN_EMAILS, ADMIN_TELEGRAM_CHAT_IDS
from app.db.session import get_db
from app.models import BackgroundJob, ContentReport, Corpus, Translation, User, Word
from app.schemas.reports import ReportAdminOut, ReportCreate, ReportOut, ReportUpdate

router = APIRouter(prefix="/reports", tags=["reports"])

ISSUE_TYPES = {"typo", "wrong_translation", "artifact", "duplicate", "other"}
STATUS_TYPES = {"open", "in_progress", "resolved", "rejected"}
SOURCE_TYPES = {"learn", "review", "onboarding", "custom", "other"}


def is_admin(user: User) -> bool:
    return user.email.strip().lower() in ADMIN_EMAILS


def build_report_out(
    report: ContentReport,
    corpus_name: str | None = None,
) -> ReportOut:
    return ReportOut(
        id=report.id,
        issue_type=report.issue_type,
        status=report.status,
        message=report.message,
        source=report.source,
        word_text=report.word_text,
        translation_text=report.translation_text,
        corpus_id=report.corpus_id,
        corpus_name=corpus_name,
        admin_note=report.admin_note,
        created_at=report.created_at,
        updated_at=report.updated_at,
        resolved_at=report.resolved_at,
    )


def build_admin_report_out(
    report: ContentReport,
    corpus_name: str | None,
    reporter_email: str,
    word_value: str | None,
    word_lang: str | None,
    translation_value: str | None,
    target_lang: str | None,
) -> ReportAdminOut:
    return ReportAdminOut(
        id=report.id,
        issue_type=report.issue_type,
        status=report.status,
        message=report.message,
        source=report.source,
        word_text=report.word_text,
        translation_text=report.translation_text,
        corpus_id=report.corpus_id,
        corpus_name=corpus_name,
        admin_note=report.admin_note,
        created_at=report.created_at,
        updated_at=report.updated_at,
        resolved_at=report.resolved_at,
        user_id=str(report.user_id),
        reporter_email=reporter_email,
        word_id=report.word_id,
        translation_id=report.translation_id,
        word_lang=word_lang,
        target_lang=target_lang,
        word_value=word_value,
        translation_value=translation_value,
    )


async def enqueue_report_notification(
    report_id: int,
    user_id,
    profile_id,
    db: AsyncSession,
) -> None:
    job = BackgroundJob(
        job_type="send_report_notifications",
        status="pending",
        payload={"report_id": report_id},
        user_id=user_id,
        profile_id=profile_id,
        run_after=datetime.now(timezone.utc),
    )
    db.add(job)
    await db.commit()


async def ensure_word(word_id: int, db: AsyncSession) -> None:
    word = await db.get(Word, word_id)
    if word is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word not found")


async def ensure_translation(translation_id: int, db: AsyncSession) -> None:
    translation = await db.get(Translation, translation_id)
    if translation is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Translation not found")


async def ensure_corpus(corpus_id: int, db: AsyncSession) -> None:
    corpus = await db.get(Corpus, corpus_id)
    if corpus is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Corpus not found")


@router.post("", response_model=ReportOut)
async def create_report(
    data: ReportCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportOut:
    issue_type = (data.issue_type or "").strip().lower()
    if issue_type not in ISSUE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid issue type")
    if (
        not data.word_text
        and not data.translation_text
        and data.word_id is None
        and data.translation_id is None
        and not data.message
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing report details")

    if data.word_id is not None:
        await ensure_word(data.word_id, db)
    if data.translation_id is not None:
        await ensure_translation(data.translation_id, db)
    if data.corpus_id is not None:
        await ensure_corpus(data.corpus_id, db)

    profile = await get_active_learning_profile(user.id, db, require_onboarding=False)
    profile_id = profile.id if profile else None
    source = (data.source or "").strip().lower() or None
    if source and source not in SOURCE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source")

    report = ContentReport(
        user_id=user.id,
        profile_id=profile_id,
        corpus_id=data.corpus_id,
        word_id=data.word_id,
        translation_id=data.translation_id,
        issue_type=issue_type,
        status="open",
        source=source,
        word_text=data.word_text.strip() if data.word_text else None,
        translation_text=data.translation_text.strip() if data.translation_text else None,
        message=data.message.strip() if data.message else None,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    await log_audit_event(
        "report.create",
        user_id=user.id,
        meta={"report_id": report.id, "issue_type": report.issue_type},
        request=request,
        db=db,
    )

    if ADMIN_EMAILS or ADMIN_TELEGRAM_CHAT_IDS:
        await enqueue_report_notification(report.id, user.id, profile_id, db)

    corpus_name = None
    if report.corpus_id:
        corpus = await db.get(Corpus, report.corpus_id)
        corpus_name = corpus.name if corpus else None
    return build_report_out(report, corpus_name)


@router.get("", response_model=list[ReportOut])
async def list_reports(
    limit: int = 20,
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReportOut]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if status_filter:
        status_filter = status_filter.strip().lower()
        if status_filter not in STATUS_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    stmt = (
        select(ContentReport, Corpus.name)
        .outerjoin(Corpus, Corpus.id == ContentReport.corpus_id)
        .where(ContentReport.user_id == user.id)
        .order_by(ContentReport.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(ContentReport.status == status_filter)
    result = await db.execute(stmt)
    return [build_report_out(row[0], row[1]) for row in result.fetchall()]


@router.get("/admin", response_model=list[ReportAdminOut])
async def list_admin_reports(
    limit: int = 50,
    status_filter: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ReportAdminOut]:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    if limit < 1 or limit > 200:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    if status_filter:
        status_filter = status_filter.strip().lower()
        if status_filter not in STATUS_TYPES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    stmt = (
        select(
            ContentReport,
            Corpus.name,
            User.email,
            Word.lemma,
            Word.lang,
            Translation.translation,
            Translation.target_lang,
        )
        .join(User, User.id == ContentReport.user_id)
        .outerjoin(Corpus, Corpus.id == ContentReport.corpus_id)
        .outerjoin(Word, Word.id == ContentReport.word_id)
        .outerjoin(Translation, Translation.id == ContentReport.translation_id)
        .order_by(ContentReport.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(ContentReport.status == status_filter)
    result = await db.execute(stmt)
    return [
        build_admin_report_out(
            row[0],
            row[1],
            row[2] or "-",
            row[3],
            row[4],
            row[5],
            row[6],
        )
        for row in result.fetchall()
    ]


@router.patch("/admin/{report_id}", response_model=ReportAdminOut)
async def update_report(
    report_id: int,
    data: ReportUpdate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportAdminOut:
    if not is_admin(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    status_value = (data.status or "").strip().lower()
    if status_value not in STATUS_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    report = await db.get(ContentReport, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    report.status = status_value
    report.admin_note = data.admin_note.strip() if data.admin_note else None
    report.updated_at = datetime.now(timezone.utc)
    if status_value in {"resolved", "rejected"}:
        report.resolved_at = datetime.now(timezone.utc)
    else:
        report.resolved_at = None

    await db.commit()
    await db.refresh(report)

    await log_audit_event(
        "report.update",
        user_id=user.id,
        meta={"report_id": report.id, "status": report.status},
        request=request,
        db=db,
    )

    corpus_name = None
    reporter_email = "-"
    if report.corpus_id:
        corpus = await db.get(Corpus, report.corpus_id)
        corpus_name = corpus.name if corpus else None
    reporter = await db.get(User, report.user_id)
    if reporter:
        reporter_email = reporter.email
    word_value = None
    word_lang = None
    translation_value = None
    target_lang = None
    if report.word_id:
        word = await db.get(Word, report.word_id)
        if word:
            word_value = word.lemma
            word_lang = word.lang
    if report.translation_id:
        translation = await db.get(Translation, report.translation_id)
        if translation:
            translation_value = translation.translation
            target_lang = translation.target_lang

    return build_admin_report_out(
        report,
        corpus_name,
        reporter_email,
        word_value,
        word_lang,
        translation_value,
        target_lang,
    )
