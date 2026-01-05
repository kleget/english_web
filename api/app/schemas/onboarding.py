from pydantic import BaseModel


class CorpusOut(BaseModel):
    id: int
    slug: str
    name: str
    source_lang: str
    target_lang: str
    words_total: int


class OnboardingCorpusIn(BaseModel):
    corpus_id: int
    target_word_limit: int = 0
    enabled: bool = True


class OnboardingRequest(BaseModel):
    native_lang: str
    target_lang: str
    daily_new_words: int = 5
    daily_review_words: int = 10
    learn_batch_size: int = 5
    corpora: list[OnboardingCorpusIn]


class OnboardingOut(BaseModel):
    status: str = "ok"


class OnboardingStateCorpusOut(BaseModel):
    corpus_id: int
    target_word_limit: int
    enabled: bool


class OnboardingStateOut(BaseModel):
    native_lang: str | None
    target_lang: str | None
    daily_new_words: int
    daily_review_words: int
    learn_batch_size: int
    corpora: list[OnboardingStateCorpusOut]
    onboarding_done: bool


class CorpusPreviewWordOut(BaseModel):
    word_id: int
    lemma: str
    translations: list[str]
    count: int
    rank: int | None


class CorpusPreviewOut(BaseModel):
    corpus_id: int
    source_lang: str
    target_lang: str
    words: list[CorpusPreviewWordOut]


class KnownWordsImportRequest(BaseModel):
    text: str


class KnownWordsImportOut(BaseModel):
    total_lines: int
    parsed_lines: int
    invalid_lines: int
    words_found: int
    words_missing: int
    inserted: int
    skipped_existing: int
