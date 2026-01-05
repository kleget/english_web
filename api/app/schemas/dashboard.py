from datetime import date

from pydantic import BaseModel


class LearnedSeriesPoint(BaseModel):
    date: date
    count: int


class DashboardOut(BaseModel):
    user_id: str
    email: str
    avatar_url: str | None
    interface_lang: str
    theme: str
    native_lang: str
    target_lang: str
    days_learning: int
    known_words: int
    learn_today: int
    learn_available: int
    review_today: int
    review_available: int
    daily_new_words: int
    daily_review_words: int
    learn_batch_size: int
    learned_series: list[LearnedSeriesPoint]
