from __future__ import annotations

import random
import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.models import (
    ChatMessage,
    FriendRequest,
    Friendship,
    GroupChallenge,
    GroupChallengeMember,
    LearningProfile,
    StudySession,
    User,
    UserChallenge,
    UserFollow,
    UserProfile,
    UserPublicProfile,
    UserWord,
)
from app.schemas.social import (
    ActivityActorOut,
    ActivityEventOut,
    ChatMessageCreateRequest,
    ChatMessageOut,
    ChallengeOut,
    ChallengeStartRequest,
    ChallengeTextOut,
    FriendOut,
    FriendRequestCreateRequest,
    FriendRequestOut,
    FollowStatusOut,
    GroupChallengeCreateRequest,
    GroupChallengeDetailOut,
    GroupChallengeJoinRequest,
    GroupChallengeMemberOut,
    GroupChallengeOut,
    LeaderboardEntryOut,
    OperationStatusOut,
    PublicProfileOut,
    PublicProfileSummaryOut,
    PublicProfileUpdateRequest,
    PublicProfileViewOut,
    PublicProfileStatsOut,
    UserChallengeOut,
)

router = APIRouter(prefix="/social", tags=["social"])

KNOWN_STATUSES = ("known", "learned")
HANDLE_RE = re.compile(r"^[a-z0-9_]{3,24}$")
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

CHALLENGES = {
    "streak_7": {
        "title": {"ru": "7-\u0434\u043d\u0435\u0432\u043d\u044b\u0439 \u0441\u0442\u0440\u0438\u043a", "en": "7-day streak"},
        "description": {
            "ru": "\u0423\u0447\u0438\u0441\u044c \u043a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c 7 \u0434\u043d\u0435\u0439 \u043f\u043e\u0434\u0440\u044f\u0434.",
            "en": "Study every day for 7 days in a row.",
        },
        "type": "streak",
        "target": 7,
        "days": 7,
    },
    "streak_21": {
        "title": {"ru": "21-\u0434\u043d\u0435\u0432\u043d\u044b\u0439 \u0441\u0442\u0440\u0438\u043a", "en": "21-day streak"},
        "description": {
            "ru": "\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0439 \u0435\u0436\u0435\u0434\u043d\u0435\u0432\u043d\u0443\u044e \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c 21 \u0434\u0435\u043d\u044c.",
            "en": "Keep daily activity for 21 days.",
        },
        "type": "streak",
        "target": 21,
        "days": 21,
    },
    "learn_100_30": {
        "title": {"ru": "100 \u0441\u043b\u043e\u0432 \u0437\u0430 30 \u0434\u043d\u0435\u0439", "en": "100 words in 30 days"},
        "description": {
            "ru": "\u0412\u044b\u0443\u0447\u0438 100 \u0441\u043b\u043e\u0432 \u0437\u0430 30 \u0434\u043d\u0435\u0439.",
            "en": "Learn 100 words in 30 days.",
        },
        "type": "learn_words",
        "target": 100,
        "days": 30,
    },
}

def normalize_handle(raw: str) -> str:
    value = raw.strip().lower()
    value = re.sub(r"[^a-z0-9_]", "", value)
    return value


async def ensure_unique_handle(base: str, db: AsyncSession) -> str:
    candidate = base
    suffix = 1
    while True:
        result = await db.execute(
            select(UserPublicProfile.user_id).where(UserPublicProfile.handle == candidate)
        )
        if result.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        suffix_text = str(suffix)
        truncated = base[: max(0, 24 - len(suffix_text))]
        candidate = f"{truncated}{suffix_text}"


async def ensure_public_profile(user: User, db: AsyncSession) -> UserPublicProfile:
    result = await db.execute(select(UserPublicProfile).where(UserPublicProfile.user_id == user.id))
    profile = result.scalar_one_or_none()
    if profile:
        return profile

    base = normalize_handle(user.email.split("@")[0])
    if not base or len(base) < 3:
        base = f"user{random.randint(1000, 9999)}"
    handle = await ensure_unique_handle(base, db)
    profile = UserPublicProfile(
        user_id=user.id,
        handle=handle,
        display_name=user.email.split("@")[0],
        is_public=False,
    )
    db.add(profile)
    await db.commit()
    return profile


def compute_streaks(days: list[date]) -> tuple[int, int]:
    if not days:
        return 0, 0
    days_sorted = sorted(set(days))
    best = 1
    current = 1
    for idx in range(1, len(days_sorted)):
        if days_sorted[idx] == days_sorted[idx - 1] + timedelta(days=1):
            current += 1
        else:
            best = max(best, current)
            current = 1
    best = max(best, current)

    latest = days_sorted[-1]
    current_streak = 1
    for idx in range(len(days_sorted) - 2, -1, -1):
        if days_sorted[idx] == latest - timedelta(days=1):
            current_streak += 1
            latest = days_sorted[idx]
        else:
            break
    return current_streak, best


async def get_profile_stats(profile: LearningProfile, db: AsyncSession) -> PublicProfileStatsOut:
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=7)

    known_result = await db.execute(
        select(func.count())
        .select_from(UserWord)
        .where(UserWord.profile_id == profile.id, UserWord.status.in_(KNOWN_STATUSES))
    )
    known_words = int(known_result.scalar() or 0)

    learned_result = await db.execute(
        select(func.count())
        .select_from(UserWord)
        .where(
            UserWord.profile_id == profile.id,
            UserWord.learned_at.is_not(None),
            UserWord.learned_at >= since,
        )
    )
    learned_7d = int(learned_result.scalar() or 0)

    session_result = await db.execute(
        select(func.date_trunc("day", StudySession.started_at))
        .where(StudySession.profile_id == profile.id)
        .group_by(func.date_trunc("day", StudySession.started_at))
    )
    session_days = [row[0].date() for row in session_result.fetchall()]
    streak_current, streak_best = compute_streaks(session_days)

    days_learning = 0
    if profile.created_at:
        days_learning = max((now.date() - profile.created_at.date()).days + 1, 1)

    return PublicProfileStatsOut(
        known_words=known_words,
        learned_7d=learned_7d,
        days_learning=days_learning,
        streak_current=streak_current,
        streak_best=streak_best,
    )


@router.get("/profile/me", response_model=PublicProfileOut)
async def get_my_public_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicProfileOut:
    profile = await ensure_public_profile(user, db)
    followers_result = await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.followee_id == user.id)
    )
    following_result = await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user.id)
    )
    return PublicProfileOut(
        handle=profile.handle,
        display_name=profile.display_name,
        bio=profile.bio,
        is_public=profile.is_public,
        followers=int(followers_result.scalar() or 0),
        following=int(following_result.scalar() or 0),
    )


@router.put("/profile", response_model=PublicProfileOut)
async def update_public_profile(
    data: PublicProfileUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PublicProfileOut:
    profile = await ensure_public_profile(user, db)

    if data.handle is not None:
        handle = normalize_handle(data.handle)
        if not HANDLE_RE.match(handle):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid handle")
        if handle != profile.handle:
            existing = await db.execute(
                select(UserPublicProfile.user_id).where(UserPublicProfile.handle == handle)
            )
            if existing.scalar_one_or_none() is not None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Handle taken")
            profile.handle = handle

    if data.display_name is not None:
        profile.display_name = data.display_name.strip() or None
    if data.bio is not None:
        profile.bio = data.bio.strip() or None
    if data.is_public is not None:
        profile.is_public = data.is_public

    profile.updated_at = datetime.now(timezone.utc)
    await db.commit()

    followers_result = await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.followee_id == user.id)
    )
    following_result = await db.execute(
        select(func.count()).select_from(UserFollow).where(UserFollow.follower_id == user.id)
    )

    return PublicProfileOut(
        handle=profile.handle,
        display_name=profile.display_name,
        bio=profile.bio,
        is_public=profile.is_public,
        followers=int(followers_result.scalar() or 0),
        following=int(following_result.scalar() or 0),
    )


@router.get("/profile/{handle}", response_model=PublicProfileViewOut)
async def get_public_profile(handle: str, db: AsyncSession = Depends(get_db)) -> PublicProfileViewOut:
    handle = normalize_handle(handle)
    result = await db.execute(
        select(UserPublicProfile, UserProfile)
        .join(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .where(UserPublicProfile.handle == handle, UserPublicProfile.is_public.is_(True))
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    public_profile = row[0]
    user_profile = row[1]
    stats = PublicProfileStatsOut(
        known_words=0,
        learned_7d=0,
        days_learning=0,
        streak_current=0,
        streak_best=0,
    )
    native_lang = None
    target_lang = None
    if user_profile.active_profile_id:
        lp_result = await db.execute(
            select(LearningProfile).where(LearningProfile.id == user_profile.active_profile_id)
        )
        learning_profile = lp_result.scalar_one_or_none()
        if learning_profile and learning_profile.onboarding_done:
            stats = await get_profile_stats(learning_profile, db)
            native_lang = learning_profile.native_lang
            target_lang = learning_profile.target_lang

    return PublicProfileViewOut(
        handle=public_profile.handle,
        display_name=public_profile.display_name,
        bio=public_profile.bio,
        avatar_url=user_profile.avatar_url,
        native_lang=native_lang,
        target_lang=target_lang,
        stats=stats,
    )


@router.get("/follow/status/{handle}", response_model=FollowStatusOut)
async def follow_status(
    handle: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FollowStatusOut:
    handle = normalize_handle(handle)
    result = await db.execute(
        select(UserPublicProfile.user_id).where(UserPublicProfile.handle == handle)
    )
    target_id = result.scalar_one_or_none()
    if target_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    follow_result = await db.execute(
        select(UserFollow).where(
            UserFollow.follower_id == user.id,
            UserFollow.followee_id == target_id,
        )
    )
    return FollowStatusOut(following=follow_result.scalar_one_or_none() is not None)


@router.post("/follow/{handle}", response_model=FollowStatusOut)
async def follow_user(
    handle: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FollowStatusOut:
    handle = normalize_handle(handle)
    result = await db.execute(
        select(UserPublicProfile.user_id, UserPublicProfile.is_public).where(
            UserPublicProfile.handle == handle
        )
    )
    row = result.first()
    if not row or not row.is_public:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if row.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    stmt = insert(UserFollow).values(follower_id=user.id, followee_id=row.user_id)
    stmt = stmt.on_conflict_do_nothing(index_elements=["follower_id", "followee_id"])
    await db.execute(stmt)
    await db.commit()
    return FollowStatusOut(following=True)


@router.delete("/follow/{handle}", response_model=FollowStatusOut)
async def unfollow_user(
    handle: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FollowStatusOut:
    handle = normalize_handle(handle)
    result = await db.execute(
        select(UserPublicProfile.user_id).where(UserPublicProfile.handle == handle)
    )
    target_id = result.scalar_one_or_none()
    if target_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    await db.execute(
        UserFollow.__table__.delete().where(
            UserFollow.follower_id == user.id,
            UserFollow.followee_id == target_id,
        )
    )
    await db.commit()
    return FollowStatusOut(following=False)


@router.get("/followers", response_model=list[PublicProfileSummaryOut])
async def followers(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PublicProfileSummaryOut]:
    result = await db.execute(
        select(UserPublicProfile.handle, UserPublicProfile.display_name, UserProfile.avatar_url)
        .select_from(UserFollow)
        .join(UserPublicProfile, UserPublicProfile.user_id == UserFollow.follower_id)
        .join(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .where(UserFollow.followee_id == user.id, UserPublicProfile.is_public.is_(True))
        .order_by(UserPublicProfile.handle)
    )
    return [
        PublicProfileSummaryOut(
            handle=row.handle,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
        )
        for row in result.fetchall()
    ]


@router.get("/following", response_model=list[PublicProfileSummaryOut])
async def following(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PublicProfileSummaryOut]:
    result = await db.execute(
        select(UserPublicProfile.handle, UserPublicProfile.display_name, UserProfile.avatar_url)
        .select_from(UserFollow)
        .join(UserPublicProfile, UserPublicProfile.user_id == UserFollow.followee_id)
        .join(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .where(UserFollow.follower_id == user.id, UserPublicProfile.is_public.is_(True))
        .order_by(UserPublicProfile.handle)
    )
    return [
        PublicProfileSummaryOut(
            handle=row.handle,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
        )
        for row in result.fetchall()
    ]


@router.get("/search", response_model=list[PublicProfileSummaryOut])
async def search_profiles(
    query: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PublicProfileSummaryOut]:
    query = (query or "").strip().lower()
    if len(query) < 2:
        return []

    stmt = (
        select(
            UserPublicProfile.handle,
            UserPublicProfile.display_name,
            UserProfile.avatar_url,
            UserFollow.follower_id,
        )
        .join(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .outerjoin(
            UserFollow,
            and_(
                UserFollow.follower_id == user.id,
                UserFollow.followee_id == UserPublicProfile.user_id,
            ),
        )
        .where(
            UserPublicProfile.is_public.is_(True),
            or_(
                UserPublicProfile.handle.ilike(f"%{query}%"),
                UserPublicProfile.display_name.ilike(f"%{query}%"),
            ),
        )
        .order_by(UserPublicProfile.handle)
        .limit(20)
    )
    rows = (await db.execute(stmt)).all()
    return [
        PublicProfileSummaryOut(
            handle=row.handle,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
            is_following=row.follower_id is not None,
        )
        for row in rows
    ]


@router.get("/leaderboard", response_model=list[LeaderboardEntryOut])
async def leaderboard(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> list[LeaderboardEntryOut]:
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=7)

    learned_expr = func.sum(case((UserWord.learned_at >= since, 1), else_=0))
    known_expr = func.sum(case((UserWord.status.in_(KNOWN_STATUSES), 1), else_=0))

    stmt = (
        select(
            UserPublicProfile.handle,
            UserPublicProfile.display_name,
            UserProfile.avatar_url,
            learned_expr.label("learned_7d"),
            known_expr.label("known_words"),
        )
        .select_from(UserPublicProfile)
        .join(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .join(LearningProfile, LearningProfile.id == UserProfile.active_profile_id)
        .outerjoin(UserWord, UserWord.profile_id == LearningProfile.id)
        .where(UserPublicProfile.is_public.is_(True))
        .group_by(UserPublicProfile.handle, UserPublicProfile.display_name, UserProfile.avatar_url)
        .order_by(learned_expr.desc().nulls_last(), known_expr.desc().nulls_last())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    results = []
    for idx, row in enumerate(rows, start=1):
        results.append(
            LeaderboardEntryOut(
                handle=row.handle,
                display_name=row.display_name,
                avatar_url=row.avatar_url,
                learned_7d=int(row.learned_7d or 0),
                known_words=int(row.known_words or 0),
                rank=idx,
            )
        )
    return results


@router.get("/challenges", response_model=list[ChallengeOut])
async def list_challenges() -> list[ChallengeOut]:
    return [
        ChallengeOut(
            key=key,
            title=ChallengeTextOut(**value["title"]),
            description=ChallengeTextOut(**value["description"]),
            challenge_type=value["type"],
            target=value["target"],
            days=value["days"],
        )
        for key, value in CHALLENGES.items()
    ]


async def compute_challenge_progress(
    challenge_key: str,
    profile_id,
    started_at: datetime,
    ends_at: datetime,
    db: AsyncSession,
) -> int:
    definition = CHALLENGES.get(challenge_key)
    if not definition:
        return 0
    now = datetime.now(timezone.utc)
    period_end = min(now, ends_at)
    if definition["type"] == "learn_words":
        result = await db.execute(
            select(func.count())
            .select_from(UserWord)
            .where(
                UserWord.profile_id == profile_id,
                UserWord.learned_at.is_not(None),
                UserWord.learned_at >= started_at,
                UserWord.learned_at <= period_end,
            )
        )
        return int(result.scalar() or 0)

    if definition["type"] == "streak":
        session_result = await db.execute(
            select(func.date_trunc("day", StudySession.started_at))
            .where(
                StudySession.profile_id == profile_id,
                StudySession.started_at >= started_at,
                StudySession.started_at <= period_end,
            )
            .group_by(func.date_trunc("day", StudySession.started_at))
        )
        days = [row[0].date() for row in session_result.fetchall()]
        streak_current, _best = compute_streaks(days)
        return streak_current
    return 0


@router.post("/challenges/start", response_model=UserChallengeOut)
async def start_challenge(
    data: ChallengeStartRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserChallengeOut:
    key = data.challenge_key
    definition = CHALLENGES.get(key)
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)

    existing_result = await db.execute(
        select(UserChallenge).where(
            UserChallenge.user_id == user.id,
            UserChallenge.profile_id == profile.id,
            UserChallenge.challenge_key == key,
            UserChallenge.status == "active",
        )
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge already active")

    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(days=definition["days"])
    challenge = UserChallenge(
        user_id=user.id,
        profile_id=profile.id,
        challenge_key=key,
        status="active",
        started_at=now,
        ends_at=ends_at,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)

    return UserChallengeOut(
        id=challenge.id,
        challenge_key=key,
        status=challenge.status,
        started_at=challenge.started_at,
        ends_at=challenge.ends_at,
        completed_at=challenge.completed_at,
        progress=0,
        target=definition["target"],
        title=ChallengeTextOut(**definition["title"]),
        description=ChallengeTextOut(**definition["description"]),
    )


@router.get("/challenges/my", response_model=list[UserChallengeOut])
async def my_challenges(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UserChallengeOut]:
    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    rows = (
        await db.execute(
            select(UserChallenge)
            .where(UserChallenge.user_id == user.id, UserChallenge.profile_id == profile.id)
            .order_by(UserChallenge.started_at.desc())
        )
    ).scalars().all()

    now = datetime.now(timezone.utc)
    updated = False
    results: list[UserChallengeOut] = []
    for row in rows:
        definition = CHALLENGES.get(row.challenge_key)
        if not definition:
            continue
        progress = await compute_challenge_progress(
            row.challenge_key,
            profile.id,
            row.started_at,
            row.ends_at,
            db,
        )
        if row.status == "active":
            if progress >= definition["target"]:
                row.status = "completed"
                row.completed_at = now
                updated = True
            elif now > row.ends_at:
                row.status = "expired"
                updated = True

        results.append(
            UserChallengeOut(
                id=row.id,
                challenge_key=row.challenge_key,
                status=row.status,
                started_at=row.started_at,
                ends_at=row.ends_at,
                completed_at=row.completed_at,
                progress=progress,
                target=definition["target"],
                title=ChallengeTextOut(**definition["title"]),
                description=ChallengeTextOut(**definition["description"]),
            )
        )

    if updated:
        await db.commit()
    return results


def build_challenge_out(key: str) -> ChallengeOut:
    definition = CHALLENGES.get(key)
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    return ChallengeOut(
        key=key,
        title=ChallengeTextOut(**definition["title"]),
        description=ChallengeTextOut(**definition["description"]),
        challenge_type=definition["type"],
        target=definition["target"],
        days=definition["days"],
    )


def build_actor(
    user_id,
    public_profile: UserPublicProfile | None,
    user_profile: UserProfile | None,
) -> ActivityActorOut:
    handle = public_profile.handle if public_profile else f"user{str(user_id)[:8]}"
    display_name = public_profile.display_name if public_profile else None
    avatar_url = user_profile.avatar_url if user_profile else None
    return ActivityActorOut(handle=handle, display_name=display_name, avatar_url=avatar_url)


async def generate_invite_code(db: AsyncSession) -> str:
    for _ in range(10):
        code = "".join(random.choice(INVITE_ALPHABET) for _ in range(6))
        result = await db.execute(
            select(GroupChallenge.id).where(GroupChallenge.invite_code == code)
        )
        if result.scalar_one_or_none() is None:
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Invite code generation failed",
    )


@router.get("/feed", response_model=list[ActivityEventOut])
async def activity_feed(
    limit: int = 20,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ActivityEventOut]:
    if limit < 1 or limit > 50:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")

    friends_result = await db.execute(
        select(Friendship.friend_id).where(Friendship.user_id == user.id)
    )
    friend_ids = [row[0] for row in friends_result.fetchall()]
    actor_ids = friend_ids + [user.id]

    events: list[ActivityEventOut] = []

    session_stmt = (
        select(StudySession, UserPublicProfile, UserProfile)
        .join(UserProfile, UserProfile.user_id == StudySession.user_id)
        .outerjoin(UserPublicProfile, UserPublicProfile.user_id == StudySession.user_id)
        .where(StudySession.user_id.in_(actor_ids), StudySession.finished_at.is_not(None))
        .order_by(StudySession.finished_at.desc())
        .limit(limit)
    )
    session_rows = (await db.execute(session_stmt)).all()
    for session, public_profile, user_profile in session_rows:
        created_at = session.finished_at or session.started_at
        events.append(
            ActivityEventOut(
                event_type="study",
                created_at=created_at,
                actor=build_actor(session.user_id, public_profile, user_profile),
                payload={
                    "session_type": session.session_type,
                    "words_total": session.words_total,
                    "words_correct": session.words_correct,
                },
            )
        )

    challenge_stmt = (
        select(UserChallenge, UserPublicProfile, UserProfile)
        .join(UserProfile, UserProfile.user_id == UserChallenge.user_id)
        .outerjoin(UserPublicProfile, UserPublicProfile.user_id == UserChallenge.user_id)
        .where(
            UserChallenge.user_id.in_(actor_ids),
            UserChallenge.status == "completed",
            UserChallenge.completed_at.is_not(None),
        )
        .order_by(UserChallenge.completed_at.desc())
        .limit(limit)
    )
    challenge_rows = (await db.execute(challenge_stmt)).all()
    for row, public_profile, user_profile in challenge_rows:
        events.append(
            ActivityEventOut(
                event_type="challenge",
                created_at=row.completed_at or row.started_at,
                actor=build_actor(row.user_id, public_profile, user_profile),
                payload={
                    "challenge_key": row.challenge_key,
                },
            )
        )

    sender_public = aliased(UserPublicProfile)
    receiver_public = aliased(UserPublicProfile)
    sender_profile = aliased(UserProfile)
    friend_stmt = (
        select(
            FriendRequest,
            sender_public.handle,
            sender_public.display_name,
            sender_profile.avatar_url,
            receiver_public.handle.label("receiver_handle"),
            receiver_public.display_name.label("receiver_name"),
        )
        .join(sender_public, sender_public.user_id == FriendRequest.sender_id)
        .join(receiver_public, receiver_public.user_id == FriendRequest.receiver_id)
        .join(sender_profile, sender_profile.user_id == FriendRequest.sender_id)
        .where(
            FriendRequest.status == "accepted",
            FriendRequest.responded_at.is_not(None),
            or_(
                FriendRequest.sender_id.in_(actor_ids),
                FriendRequest.receiver_id.in_(actor_ids),
            ),
        )
        .order_by(FriendRequest.responded_at.desc())
        .limit(limit)
    )
    friend_rows = (await db.execute(friend_stmt)).all()
    for row in friend_rows:
        request = row[0]
        events.append(
            ActivityEventOut(
                event_type="friendship",
                created_at=request.responded_at or request.created_at,
                actor=ActivityActorOut(
                    handle=row.handle,
                    display_name=row.display_name,
                    avatar_url=row.avatar_url,
                ),
                payload={
                    "friend_handle": row.receiver_handle,
                    "friend_name": row.receiver_name,
                },
            )
        )

    group_stmt = (
        select(GroupChallengeMember, GroupChallenge, UserPublicProfile, UserProfile)
        .join(GroupChallenge, GroupChallenge.id == GroupChallengeMember.group_id)
        .join(UserProfile, UserProfile.user_id == GroupChallengeMember.user_id)
        .outerjoin(UserPublicProfile, UserPublicProfile.user_id == GroupChallengeMember.user_id)
        .where(GroupChallengeMember.user_id.in_(actor_ids))
        .order_by(GroupChallengeMember.joined_at.desc())
        .limit(limit)
    )
    group_rows = (await db.execute(group_stmt)).all()
    for member, group, public_profile, user_profile in group_rows:
        events.append(
            ActivityEventOut(
                event_type="group_join",
                created_at=member.joined_at,
                actor=build_actor(member.user_id, public_profile, user_profile),
                payload={
                    "group_id": group.id,
                    "challenge_key": group.challenge_key,
                    "invite_code": group.invite_code,
                },
            )
        )

    events.sort(key=lambda item: item.created_at, reverse=True)
    return events[:limit]


@router.get("/friends/requests", response_model=list[FriendRequestOut])
async def list_friend_requests(
    direction: str = "incoming",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FriendRequestOut]:
    if direction not in {"incoming", "outgoing"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid direction")

    if direction == "incoming":
        other_public = aliased(UserPublicProfile)
        other_profile = aliased(UserProfile)
        stmt = (
            select(FriendRequest, other_public.handle, other_public.display_name, other_profile.avatar_url)
            .join(other_public, other_public.user_id == FriendRequest.sender_id)
            .join(other_profile, other_profile.user_id == FriendRequest.sender_id)
            .where(FriendRequest.receiver_id == user.id, FriendRequest.status == "pending")
            .order_by(FriendRequest.created_at.desc())
        )
    else:
        other_public = aliased(UserPublicProfile)
        other_profile = aliased(UserProfile)
        stmt = (
            select(FriendRequest, other_public.handle, other_public.display_name, other_profile.avatar_url)
            .join(other_public, other_public.user_id == FriendRequest.receiver_id)
            .join(other_profile, other_profile.user_id == FriendRequest.receiver_id)
            .where(FriendRequest.sender_id == user.id, FriendRequest.status == "pending")
            .order_by(FriendRequest.created_at.desc())
        )

    rows = (await db.execute(stmt)).all()
    return [
        FriendRequestOut(
            id=row[0].id,
            handle=row.handle,
            display_name=row.display_name,
            avatar_url=row.avatar_url,
            direction=direction,
            status=row[0].status,
            created_at=row[0].created_at,
        )
        for row in rows
    ]


@router.post("/friends/requests", response_model=FriendRequestOut)
async def create_friend_request(
    data: FriendRequestCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    handle = normalize_handle(data.handle)
    if not HANDLE_RE.match(handle):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid handle")

    target_result = await db.execute(
        select(UserPublicProfile).where(UserPublicProfile.handle == handle)
    )
    target_profile = target_result.scalar_one_or_none()
    if target_profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    if target_profile.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot request yourself")

    friend_exists = await db.execute(
        select(Friendship).where(
            Friendship.user_id == user.id,
            Friendship.friend_id == target_profile.user_id,
        )
    )
    if friend_exists.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Already friends")

    existing = await db.execute(
        select(FriendRequest).where(
            or_(
                and_(
                    FriendRequest.sender_id == user.id,
                    FriendRequest.receiver_id == target_profile.user_id,
                ),
                and_(
                    FriendRequest.sender_id == target_profile.user_id,
                    FriendRequest.receiver_id == user.id,
                ),
            )
        )
    )
    existing_request = existing.scalar_one_or_none()
    if existing_request is not None and existing_request.status == "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request already pending")

    if existing_request is not None and existing_request.sender_id == user.id:
        existing_request.status = "pending"
        existing_request.responded_at = None
        await db.commit()
        request = existing_request
    else:
        request = FriendRequest(sender_id=user.id, receiver_id=target_profile.user_id)
        db.add(request)
        await db.commit()
        await db.refresh(request)

    profile_result = await db.execute(
        select(UserProfile.avatar_url).where(UserProfile.user_id == target_profile.user_id)
    )
    avatar_url = profile_result.scalar_one_or_none()

    return FriendRequestOut(
        id=request.id,
        handle=target_profile.handle,
        display_name=target_profile.display_name,
        avatar_url=avatar_url,
        direction="outgoing",
        status=request.status,
        created_at=request.created_at,
    )


@router.post("/friends/requests/{request_id}/accept", response_model=FriendRequestOut)
async def accept_friend_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    request_result = await db.execute(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == "pending",
        )
    )
    request = request_result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    now = datetime.now(timezone.utc)
    request.status = "accepted"
    request.responded_at = now

    rows = [
        {"user_id": user.id, "friend_id": request.sender_id},
        {"user_id": request.sender_id, "friend_id": user.id},
    ]
    stmt = insert(Friendship).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["user_id", "friend_id"])
    await db.execute(stmt)
    await db.commit()

    sender_result = await db.execute(
        select(UserPublicProfile, UserProfile).join(
            UserProfile, UserProfile.user_id == UserPublicProfile.user_id
        )
        .where(UserPublicProfile.user_id == request.sender_id)
    )
    row = sender_result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return FriendRequestOut(
        id=request.id,
        handle=row[0].handle,
        display_name=row[0].display_name,
        avatar_url=row[1].avatar_url,
        direction="incoming",
        status=request.status,
        created_at=request.created_at,
    )


@router.post("/friends/requests/{request_id}/decline", response_model=FriendRequestOut)
async def decline_friend_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    request_result = await db.execute(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == "pending",
        )
    )
    request = request_result.scalar_one_or_none()
    if request is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    request.status = "declined"
    request.responded_at = datetime.now(timezone.utc)
    await db.commit()

    sender_result = await db.execute(
        select(UserPublicProfile, UserProfile).join(
            UserProfile, UserProfile.user_id == UserPublicProfile.user_id
        )
        .where(UserPublicProfile.user_id == request.sender_id)
    )
    row = sender_result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    return FriendRequestOut(
        id=request.id,
        handle=row[0].handle,
        display_name=row[0].display_name,
        avatar_url=row[1].avatar_url,
        direction="incoming",
        status=request.status,
        created_at=request.created_at,
    )


@router.get("/friends", response_model=list[FriendOut])
async def list_friends(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FriendOut]:
    stmt = (
        select(Friendship, UserPublicProfile, UserProfile)
        .join(UserPublicProfile, UserPublicProfile.user_id == Friendship.friend_id)
        .join(UserProfile, UserProfile.user_id == Friendship.friend_id)
        .where(Friendship.user_id == user.id)
        .order_by(UserPublicProfile.handle)
    )
    rows = (await db.execute(stmt)).all()
    return [
        FriendOut(
            handle=row[1].handle,
            display_name=row[1].display_name,
            avatar_url=row[2].avatar_url,
            since=row[0].created_at,
        )
        for row in rows
    ]


@router.delete("/friends/{handle}", response_model=OperationStatusOut)
async def remove_friend(
    handle: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OperationStatusOut:
    handle = normalize_handle(handle)
    target_result = await db.execute(
        select(UserPublicProfile.user_id).where(UserPublicProfile.handle == handle)
    )
    target_id = target_result.scalar_one_or_none()
    if target_id is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")

    await db.execute(
        Friendship.__table__.delete().where(
            or_(
                and_(Friendship.user_id == user.id, Friendship.friend_id == target_id),
                and_(Friendship.user_id == target_id, Friendship.friend_id == user.id),
            )
        )
    )
    await db.commit()
    return OperationStatusOut(ok=True)


@router.get("/chat/messages", response_model=list[ChatMessageOut])
async def list_chat_messages(
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ChatMessageOut]:
    if limit < 1 or limit > 100:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")

    stmt = (
        select(ChatMessage, UserPublicProfile, UserProfile)
        .join(UserProfile, UserProfile.user_id == ChatMessage.user_id)
        .outerjoin(UserPublicProfile, UserPublicProfile.user_id == ChatMessage.user_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    rows.reverse()
    return [
        ChatMessageOut(
            id=row[0].id,
            message=row[0].message,
            created_at=row[0].created_at,
            author=build_actor(row[0].user_id, row[1], row[2]),
        )
        for row in rows
    ]


@router.post("/chat/messages", response_model=ChatMessageOut)
async def create_chat_message(
    data: ChatMessageCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageOut:
    message = (data.message or "").strip()
    if not message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message required")
    if len(message) > 500:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message too long")

    await ensure_public_profile(user, db)
    chat = ChatMessage(user_id=user.id, message=message)
    db.add(chat)
    await db.commit()
    await db.refresh(chat)

    profile_result = await db.execute(
        select(UserPublicProfile, UserProfile)
        .outerjoin(UserProfile, UserProfile.user_id == UserPublicProfile.user_id)
        .where(UserPublicProfile.user_id == user.id)
    )
    row = profile_result.first()
    if row:
        public_profile, user_profile = row
    else:
        public_profile = None
        user_profile = None

    return ChatMessageOut(
        id=chat.id,
        message=chat.message,
        created_at=chat.created_at,
        author=build_actor(user.id, public_profile, user_profile),
    )


@router.get("/group-challenges", response_model=list[GroupChallengeOut])
async def list_group_challenges(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GroupChallengeOut]:
    counts_sub = (
        select(
            GroupChallengeMember.group_id,
            func.count().label("members_count"),
        )
        .group_by(GroupChallengeMember.group_id)
        .subquery()
    )
    stmt = (
        select(GroupChallenge, counts_sub.c.members_count)
        .join(GroupChallengeMember, GroupChallengeMember.group_id == GroupChallenge.id)
        .join(counts_sub, counts_sub.c.group_id == GroupChallenge.id)
        .where(GroupChallengeMember.user_id == user.id)
        .order_by(GroupChallenge.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    results: list[GroupChallengeOut] = []
    for group, members_count in rows:
        challenge_out = build_challenge_out(group.challenge_key)
        results.append(
            GroupChallengeOut(
                id=group.id,
                challenge_key=group.challenge_key,
                title=group.title,
                status=group.status,
                invite_code=group.invite_code,
                started_at=group.started_at,
                ends_at=group.ends_at,
                members_count=int(members_count or 0),
                challenge=challenge_out,
            )
        )
    return results


@router.post("/group-challenges", response_model=GroupChallengeOut)
async def create_group_challenge(
    data: GroupChallengeCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupChallengeOut:
    definition = CHALLENGES.get(data.challenge_key)
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)

    code = await generate_invite_code(db)
    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(days=definition["days"])

    group = GroupChallenge(
        owner_id=user.id,
        challenge_key=data.challenge_key,
        title=(data.title or "").strip() or None,
        status="active",
        invite_code=code,
        started_at=now,
        ends_at=ends_at,
    )
    db.add(group)
    await db.flush()

    member = GroupChallengeMember(
        group_id=group.id,
        user_id=user.id,
        profile_id=profile.id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(group)

    return GroupChallengeOut(
        id=group.id,
        challenge_key=group.challenge_key,
        title=group.title,
        status=group.status,
        invite_code=group.invite_code,
        started_at=group.started_at,
        ends_at=group.ends_at,
        members_count=1,
        challenge=build_challenge_out(group.challenge_key),
    )


@router.post("/group-challenges/join", response_model=GroupChallengeOut)
async def join_group_challenge(
    data: GroupChallengeJoinRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupChallengeOut:
    code = (data.invite_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invite code required")

    group_result = await db.execute(
        select(GroupChallenge).where(GroupChallenge.invite_code == code)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    now = datetime.now(timezone.utc)
    if group.ends_at and now > group.ends_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge expired")

    profile = await get_active_learning_profile(user.id, db, require_onboarding=True)
    existing_member = await db.execute(
        select(GroupChallengeMember).where(
            GroupChallengeMember.group_id == group.id,
            GroupChallengeMember.user_id == user.id,
        )
    )
    if existing_member.scalar_one_or_none() is None:
        db.add(
            GroupChallengeMember(
                group_id=group.id,
                user_id=user.id,
                profile_id=profile.id,
            )
        )
        await db.commit()
    else:
        await db.commit()

    members_count_result = await db.execute(
        select(func.count()).select_from(GroupChallengeMember).where(
            GroupChallengeMember.group_id == group.id
        )
    )
    members_count = int(members_count_result.scalar() or 0)

    return GroupChallengeOut(
        id=group.id,
        challenge_key=group.challenge_key,
        title=group.title,
        status=group.status,
        invite_code=group.invite_code,
        started_at=group.started_at,
        ends_at=group.ends_at,
        members_count=members_count,
        challenge=build_challenge_out(group.challenge_key),
    )


@router.get("/group-challenges/{group_id}", response_model=GroupChallengeDetailOut)
async def group_challenge_detail(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GroupChallengeDetailOut:
    group_result = await db.execute(
        select(GroupChallenge).where(GroupChallenge.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")

    membership_result = await db.execute(
        select(GroupChallengeMember).where(
            GroupChallengeMember.group_id == group.id,
            GroupChallengeMember.user_id == user.id,
        )
    )
    if membership_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member")

    definition = CHALLENGES.get(group.challenge_key)
    if not definition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    members_stmt = (
        select(GroupChallengeMember, UserPublicProfile, UserProfile)
        .join(UserProfile, UserProfile.user_id == GroupChallengeMember.user_id)
        .outerjoin(UserPublicProfile, UserPublicProfile.user_id == GroupChallengeMember.user_id)
        .where(GroupChallengeMember.group_id == group.id)
        .order_by(GroupChallengeMember.joined_at)
    )
    member_rows = (await db.execute(members_stmt)).all()
    members: list[GroupChallengeMemberOut] = []
    for member, public_profile, user_profile in member_rows:
        progress = await compute_challenge_progress(
            group.challenge_key,
            member.profile_id,
            group.started_at,
            group.ends_at,
            db,
        )
        actor = build_actor(member.user_id, public_profile, user_profile)
        members.append(
            GroupChallengeMemberOut(
                handle=actor.handle,
                display_name=actor.display_name,
                avatar_url=actor.avatar_url,
                progress=progress,
                target=definition["target"],
            )
        )

    members_count = len(member_rows)
    group_out = GroupChallengeOut(
        id=group.id,
        challenge_key=group.challenge_key,
        title=group.title,
        status=group.status,
        invite_code=group.invite_code,
        started_at=group.started_at,
        ends_at=group.ends_at,
        members_count=members_count,
        challenge=build_challenge_out(group.challenge_key),
    )
    return GroupChallengeDetailOut(group=group_out, members=members)


@router.post("/group-challenges/{group_id}/leave", response_model=OperationStatusOut)
async def leave_group_challenge(
    group_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OperationStatusOut:
    group_result = await db.execute(
        select(GroupChallenge).where(GroupChallenge.id == group_id)
    )
    group = group_result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    if group.owner_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Owner cannot leave")

    await db.execute(
        GroupChallengeMember.__table__.delete().where(
            GroupChallengeMember.group_id == group.id,
            GroupChallengeMember.user_id == user.id,
        )
    )
    await db.commit()
    return OperationStatusOut(ok=True)
