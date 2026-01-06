from datetime import datetime

from pydantic import BaseModel


class CustomWordIn(BaseModel):
    word: str
    translation: str


class CustomWordOut(BaseModel):
    word_id: int
    word: str
    translation: str
    created_at: datetime | None = None


class CustomWordsImportRequest(BaseModel):
    text: str


class CustomWordsImportOut(BaseModel):
    total_lines: int
    parsed_lines: int
    invalid_lines: int
    inserted: int
    updated: int
    skipped: int
