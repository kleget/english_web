from pydantic import BaseModel


class AdminCorpusOut(BaseModel):
    id: int
    slug: str
    name: str
    words_total: int


class AdminCorpusTranslationOut(BaseModel):
    id: int
    translation: str


class AdminCorpusWordOut(BaseModel):
    word_id: int
    lemma: str
    lang: str
    count: int
    rank: int | None
    translations: list[AdminCorpusTranslationOut]


class AdminCorpusWordsOut(BaseModel):
    total: int
    items: list[AdminCorpusWordOut]
