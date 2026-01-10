from pydantic import BaseModel


class AdminWordUpdate(BaseModel):
    lemma: str


class AdminWordOut(BaseModel):
    id: int
    lemma: str
    lang: str


class AdminTranslationUpdate(BaseModel):
    translation: str


class AdminTranslationOut(BaseModel):
    id: int
    word_id: int
    target_lang: str
    translation: str
