from __future__ import annotations

import argparse
import asyncio
import os
import smtplib
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path

from sqlalchemy import func, select

BASE_DIR = Path(__file__).resolve().parents[1]
API_DIR = BASE_DIR / "api"
SCRIPTS_DIR = BASE_DIR / "scripts"
sys.path.append(str(API_DIR))
sys.path.append(str(SCRIPTS_DIR))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            os.environ.setdefault(key, value)


load_env_file(BASE_DIR / ".env")

from app.api.dashboard import get_dashboard  # noqa: E402
from app.api.stats import weak_words  # noqa: E402
from app.core.config import (  # noqa: E402
    ADMIN_EMAILS,
    ADMIN_TELEGRAM_CHAT_IDS,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_TLS,
    SMTP_USER,
    TELEGRAM_BOT_TOKEN,
)
from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models import (  # noqa: E402
    BackgroundJob,
    ContentReport,
    Corpus,
    LearningProfile,
    NotificationOutbox,
    NotificationSettings,
    Translation,
    User,
    UserCustomWord,
    UserWord,
)

import import_sqlite  # noqa: E402

ISSUE_LABELS = {
    "typo": "\u041e\u043f\u0435\u0447\u0430\u0442\u043a\u0430",
    "wrong_translation": "\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u043f\u0435\u0440\u0435\u0432\u043e\u0434",
    "artifact": "\u0410\u0440\u0442\u0435\u0444\u0430\u043a\u0442",
    "duplicate": "\u0414\u0443\u0431\u043b\u044c",
    "other": "\u0414\u0440\u0443\u0433\u043e\u0435",
}
SOURCE_LABELS = {
    "learn": "\u0423\u0447\u0438\u0442\u044c",
    "review": "\u041f\u043e\u0432\u0442\u043e\u0440\u044f\u0442\u044c",
    "onboarding": "\u041e\u043d\u0431\u043e\u0440\u0434\u0438\u043d\u0433",
    "custom": "\u041c\u043e\u0438 \u0441\u043b\u043e\u0432\u0430",
    "other": "\u0414\u0440\u0443\u0433\u043e\u0435",
}


async def load_pending_jobs(session, limit: int):
    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(BackgroundJob)
        .where(
            BackgroundJob.status == "pending",
            BackgroundJob.run_after <= now,
        )
        .order_by(BackgroundJob.created_at)
        .limit(limit)
    )
    return result.scalars().all()


async def mark_running(session, job: BackgroundJob) -> None:
    job.status = "running"
    job.started_at = datetime.now(timezone.utc)
    job.attempts = (job.attempts or 0) + 1
    job.updated_at = datetime.now(timezone.utc)
    await session.commit()


async def mark_done(session, job: BackgroundJob, result: dict | None = None) -> None:
    job.status = "done"
    job.result = result
    job.last_error = None
    job.finished_at = datetime.now(timezone.utc)
    job.updated_at = datetime.now(timezone.utc)
    await session.commit()


async def mark_failed(session, job: BackgroundJob, message: str) -> None:
    job.last_error = message
    job.updated_at = datetime.now(timezone.utc)
    if (job.attempts or 0) >= (job.max_attempts or 1):
        job.status = "failed"
    else:
        job.status = "pending"
    await session.commit()


async def process_refresh_stats(session, job: BackgroundJob) -> dict:
    if not job.user_id:
        raise ValueError("job user_id is required")
    result = await session.execute(select(User).where(User.id == job.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("user not found")
    dashboard = await get_dashboard(refresh=True, user=user, db=session)
    weak = await weak_words(limit=20, refresh=True, user=user, db=session)
    return {"dashboard": True, "weak_words": True, "known_words": dashboard.known_words, "weak_total": weak.total}


async def process_generate_report(session, job: BackgroundJob) -> dict:
    if not job.user_id:
        raise ValueError("job user_id is required")
    result = await session.execute(select(User).where(User.id == job.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise ValueError("user not found")
    dashboard = await get_dashboard(refresh=True, user=user, db=session)
    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "known_words": dashboard.known_words,
        "learn_today": dashboard.learn_today,
        "review_today": dashboard.review_today,
        "review_available": dashboard.review_available,
        "days_learning": dashboard.days_learning,
    }
    return report


async def process_send_review_notifications(session, job: BackgroundJob) -> dict:
    now = datetime.now(timezone.utc)
    settings_stmt = select(NotificationSettings)
    if job.profile_id:
        settings_stmt = settings_stmt.where(NotificationSettings.profile_id == job.profile_id)
    settings_rows = (await session.execute(settings_stmt)).scalars().all()
    created = 0
    for settings in settings_rows:
        if not (settings.email_enabled or settings.telegram_enabled or settings.push_enabled):
            continue
        if settings.review_hour is not None and now.hour < settings.review_hour:
            continue
        if settings.last_notified_at and settings.last_notified_at.date() == now.date():
            continue

        profile_result = await session.execute(
            select(LearningProfile).where(LearningProfile.id == settings.profile_id)
        )
        learning_profile = profile_result.scalar_one_or_none()
        if not learning_profile:
            continue

        due_subq = (
            select(UserWord.word_id)
            .where(
                UserWord.profile_id == settings.profile_id,
                UserWord.next_review_at.is_not(None),
                UserWord.next_review_at <= now,
            )
            .subquery()
        )
        translation_subq = (
            select(Translation.word_id)
            .where(
                Translation.word_id.in_(select(due_subq.c.word_id)),
                Translation.target_lang == learning_profile.target_lang,
            )
        )
        custom_subq = (
            select(UserCustomWord.word_id)
            .where(
                UserCustomWord.profile_id == settings.profile_id,
                UserCustomWord.target_lang == learning_profile.target_lang,
                UserCustomWord.word_id.in_(select(due_subq.c.word_id)),
            )
        )
        review_result = await session.execute(
            select(func.count()).select_from(translation_subq.union(custom_subq).subquery())
        )
        review_due = int(review_result.scalar() or 0)
        if review_due == 0:
            continue

        payload = {"review_due": review_due}
        channels = []
        if settings.email_enabled:
            channels.append("email")
        if settings.telegram_enabled:
            channels.append("telegram")
        if settings.push_enabled:
            channels.append("push")
        for channel in channels:
            session.add(
                NotificationOutbox(
                    profile_id=settings.profile_id,
                    user_id=settings.user_id,
                    channel=channel,
                    payload=payload,
                    status="pending",
                    scheduled_at=now,
                )
            )
            created += 1
        settings.last_notified_at = now

    await session.commit()
    return {"notifications_created": created}


def build_report_message(report: ContentReport, corpus_name: str | None, reporter_email: str) -> tuple[str, str]:
    issue_label = ISSUE_LABELS.get(report.issue_type, report.issue_type)
    source_label = SOURCE_LABELS.get(report.source or "other", report.source or "other")
    subject = f"[English Web] \u0420\u0435\u043f\u043e\u0440\u0442 #{report.id}: {issue_label}"
    parts = [
        f"\u0422\u0438\u043f: {issue_label}",
        f"\u0421\u0442\u0430\u0442\u0443\u0441: {report.status}",
        f"\u0421\u043b\u043e\u0432\u043e: {report.word_text or '-'}",
        f"\u041f\u0435\u0440\u0435\u0432\u043e\u0434: {report.translation_text or '-'}",
        f"\u0421\u0444\u0435\u0440\u0430: {corpus_name or '-'}",
        f"\u0413\u0434\u0435: {source_label}",
        f"\u041e\u0442: {reporter_email}",
        f"\u041a\u043e\u043c\u043c\u0435\u043d\u0442\u0430\u0440\u0438\u0439: {report.message or '-'}",
    ]
    return subject, "\n".join(parts)


def send_email(recipients: set[str], subject: str, body: str) -> None:
    if not SMTP_HOST:
        raise ValueError("SMTP is not configured")
    sender = SMTP_FROM or SMTP_USER or "english-web@local"
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = sender
    msg["To"] = ", ".join(sorted(recipients))
    msg.set_content(body)

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
        if SMTP_TLS:
            server.starttls()
        if SMTP_USER:
            server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)


def send_telegram(chat_id: str, text: str) -> None:
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("Telegram bot token is not configured")
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": text}
    data = urllib.parse.urlencode(payload).encode("utf-8")
    request = urllib.request.Request(url, data=data)
    with urllib.request.urlopen(request, timeout=15) as response:
        response.read()


async def process_send_report_notifications(session, job: BackgroundJob) -> dict:
    payload = job.payload or {}
    report_id = payload.get("report_id")
    if not report_id:
        raise ValueError("report_id is required")

    report = await session.get(ContentReport, int(report_id))
    if not report:
        raise ValueError("report not found")

    corpus_name = None
    if report.corpus_id:
        corpus = await session.get(Corpus, report.corpus_id)
        corpus_name = corpus.name if corpus else None

    reporter_email = "-"
    reporter = await session.get(User, report.user_id)
    if reporter:
        reporter_email = reporter.email

    subject, body = build_report_message(report, corpus_name, reporter_email)
    sent = 0
    errors: list[str] = []

    if ADMIN_EMAILS:
        try:
            send_email(ADMIN_EMAILS, subject, body)
            sent += len(ADMIN_EMAILS)
        except Exception as exc:
            errors.append(f"email: {exc}")
    if ADMIN_TELEGRAM_CHAT_IDS:
        if not TELEGRAM_BOT_TOKEN:
            errors.append("telegram: missing token")
        else:
            for chat_id in ADMIN_TELEGRAM_CHAT_IDS:
                try:
                    send_telegram(chat_id, body)
                    sent += 1
                except Exception as exc:
                    errors.append(f"telegram {chat_id}: {exc}")

    if sent == 0 and errors:
        raise ValueError("; ".join(errors))

    return {"sent": sent, "errors": errors}


async def process_import_words(session, job: BackgroundJob) -> dict:
    payload = job.payload or {}
    sqlite_dir = Path(payload.get("sqlite_dir") or "E:/Code/english_project/database")
    map_path = Path(payload.get("map_path") or "scripts/import_map.json")
    await import_sqlite.run(sqlite_dir, map_path)
    return {"imported": True, "sqlite_dir": str(sqlite_dir), "map_path": str(map_path)}


async def handle_job(session, job: BackgroundJob) -> None:
    await mark_running(session, job)
    try:
        if job.job_type == "refresh_stats":
            result = await process_refresh_stats(session, job)
        elif job.job_type == "send_review_notifications":
            result = await process_send_review_notifications(session, job)
        elif job.job_type == "import_words":
            result = await process_import_words(session, job)
        elif job.job_type == "generate_report":
            result = await process_generate_report(session, job)
        elif job.job_type == "send_report_notifications":
            result = await process_send_report_notifications(session, job)
        else:
            raise ValueError(f"unknown job type: {job.job_type}")
        await mark_done(session, job, result=result)
    except Exception as exc:
        await mark_failed(session, job, str(exc))


async def run_once(limit: int) -> int:
    async with AsyncSessionLocal() as session:
        jobs = await load_pending_jobs(session, limit)
        if not jobs:
            return 0
        for job in jobs:
            await handle_job(session, job)
        return len(jobs)


async def run_loop(limit: int, interval: int) -> None:
    while True:
        processed = await run_once(limit)
        if processed == 0:
            await asyncio.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--interval", type=int, default=15)
    parser.add_argument("--loop", action="store_true")
    args = parser.parse_args()
    if args.loop:
        asyncio.run(run_loop(args.limit, args.interval))
    else:
        asyncio.run(run_once(args.limit))


if __name__ == "__main__":
    main()
