from datetime import datetime

from pydantic import BaseModel


class LearnWordOut(BaseModel):
    word_id: int
    word: str
    translation: str
    rank: int | None = None
    count: int | None = None


class ReadingOut(BaseModel):
    title: str
    text: str
    corpus_name: str | None = None
    domain: str | None = None


class LearnStartOut(BaseModel):
    session_id: int | None
    words: list[LearnWordOut]
    reading: ReadingOut | None = None


class LearnSubmitWord(BaseModel):
    word_id: int
    answer: str = ""


class LearnSubmitRequest(BaseModel):
    session_id: int | None = None
    words: list[LearnSubmitWord]


class AnswerResult(BaseModel):
    word_id: int
    correct: bool
    correct_answers: list[str]


class LearnSubmitOut(BaseModel):
    all_correct: bool
    words_total: int
    words_correct: int
    learned: int
    results: list[AnswerResult]


class ReviewWordOut(BaseModel):
    word_id: int
    word: str
    translation: str
    learned_at: datetime | None = None
    next_review_at: datetime | None = None
    stage: int | None = None


class ReviewStartOut(BaseModel):
    session_id: int | None
    words: list[ReviewWordOut]


class ReviewSubmitWord(BaseModel):
    word_id: int
    answer: str = ""
    quality: int | None = None


class ReviewSubmitRequest(BaseModel):
    session_id: int | None = None
    words: list[ReviewSubmitWord]


class ReviewSubmitOut(BaseModel):
    words_total: int
    words_correct: int
    words_incorrect: int
    results: list[AnswerResult]


class ReviewSeedOut(BaseModel):
    seeded: int
