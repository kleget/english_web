from datetime import datetime
from typing import Any

from pydantic import BaseModel


class PublicProfileOut(BaseModel):
    handle: str
    display_name: str | None
    bio: str | None
    is_public: bool
    followers: int
    following: int


class PublicProfileUpdateRequest(BaseModel):
    handle: str | None = None
    display_name: str | None = None
    bio: str | None = None
    is_public: bool | None = None


class PublicProfileStatsOut(BaseModel):
    known_words: int
    learned_7d: int
    days_learning: int
    streak_current: int
    streak_best: int


class PublicProfileViewOut(BaseModel):
    handle: str
    display_name: str | None
    bio: str | None
    avatar_url: str | None
    native_lang: str | None
    target_lang: str | None
    stats: PublicProfileStatsOut


class PublicProfileSummaryOut(BaseModel):
    handle: str
    display_name: str | None
    avatar_url: str | None
    is_following: bool | None = None


class FollowStatusOut(BaseModel):
    following: bool


class LeaderboardEntryOut(BaseModel):
    handle: str
    display_name: str | None
    avatar_url: str | None
    learned_7d: int
    known_words: int
    rank: int


class ChallengeTextOut(BaseModel):
    ru: str
    en: str


class ChallengeOut(BaseModel):
    key: str
    title: ChallengeTextOut
    description: ChallengeTextOut
    challenge_type: str
    target: int
    days: int


class ChallengeStartRequest(BaseModel):
    challenge_key: str


class UserChallengeOut(BaseModel):
    id: int
    challenge_key: str
    status: str
    started_at: datetime
    ends_at: datetime
    completed_at: datetime | None
    progress: int
    target: int
    title: ChallengeTextOut
    description: ChallengeTextOut


class FriendRequestCreateRequest(BaseModel):
    handle: str


class FriendRequestOut(BaseModel):
    id: int
    handle: str
    display_name: str | None
    avatar_url: str | None
    direction: str
    status: str
    created_at: datetime


class FriendOut(BaseModel):
    handle: str
    display_name: str | None
    avatar_url: str | None
    since: datetime


class ActivityActorOut(BaseModel):
    handle: str
    display_name: str | None
    avatar_url: str | None


class ActivityEventOut(BaseModel):
    event_type: str
    created_at: datetime
    actor: ActivityActorOut
    payload: dict[str, Any]


class ChatMessageCreateRequest(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    message: str
    created_at: datetime
    author: ActivityActorOut


class GroupChallengeCreateRequest(BaseModel):
    challenge_key: str
    title: str | None = None


class GroupChallengeJoinRequest(BaseModel):
    invite_code: str


class GroupChallengeOut(BaseModel):
    id: int
    challenge_key: str
    title: str | None
    status: str
    invite_code: str
    started_at: datetime
    ends_at: datetime
    members_count: int
    challenge: ChallengeOut


class GroupChallengeMemberOut(BaseModel):
    handle: str
    display_name: str | None
    avatar_url: str | None
    progress: int
    target: int


class GroupChallengeDetailOut(BaseModel):
    group: GroupChallengeOut
    members: list[GroupChallengeMemberOut]


class OperationStatusOut(BaseModel):
    ok: bool
