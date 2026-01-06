from __future__ import annotations

import random
import re
from difflib import SequenceMatcher
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import get_active_learning_profile, get_current_user
from app.db.session import get_db
from app.core.audit import log_audit_event
from app.models import (
    Corpus,
    CorpusWordStat,
    LearningProfile,
    ReviewEvent,
    StudySession,
    Translation,
    User,
    UserCorpus,
    UserCustomWord,
    UserProfile,
    UserSettings,
    UserWord,
    Word,
)
from app.schemas.study import (
    LearnStartOut,
    LearnSubmitOut,
    LearnSubmitRequest,
    LearnWordOut,
    ReviewSeedOut,
    ReviewStartOut,
    ReviewSubmitOut,
    ReviewSubmitRequest,
    ReviewWordOut,
)

router = APIRouter(prefix="/study", tags=["study"])


async def load_profile_settings(user_id, db: AsyncSession) -> tuple[LearningProfile, UserSettings]:
    profile = await get_active_learning_profile(user_id, db, require_onboarding=True)

    settings_result = await db.execute(
        select(UserSettings).where(UserSettings.profile_id == profile.id)
    )
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(profile_id=profile.id, user_id=user_id)
        db.add(settings)
        await db.commit()
    return profile, settings


READING_LIBRARY = {
    "agriculture": {
        "ru": [
            {
                "title": "Поле и сезон",
                "text": "Агроном читает поле как книгу: по цвету листьев видно, чего не хватает почве. Один сезон — это десятки решений: когда сеять, чем подкармливать, как сберечь влагу."
            },
            {
                "title": "Почва как система",
                "text": "Почва — живая система, где корни и микроорганизмы договариваются каждый день. Умелый уход превращает урожай в прогнозируемый результат, а не лотерею."
            },
        ],
        "en": [
            {
                "title": "Field and season",
                "text": "An agronomist reads a field like a book: leaf color reveals what the soil lacks. A season is a chain of choices—when to sow, how to feed, how to keep moisture."
            },
            {
                "title": "Soil as a system",
                "text": "Soil is a living system where roots and microbes negotiate daily. Thoughtful care turns a harvest into a predictable result, not a lottery."
            },
        ],
    },
    "biology": {
        "ru": [
            {
                "title": "Город внутри клетки",
                "text": "Клетка похожа на город: одни структуры строят, другие перевозят, третьи контролируют порядок. Биология учит видеть жизнь в деталях и связи между ними."
            },
            {
                "title": "Язык живых систем",
                "text": "Живые системы экономят энергию, избегают ошибок и умеют восстанавливаться. В этом есть своя логика, которую можно наблюдать в каждом организме."
            },
        ],
        "en": [
            {
                "title": "City inside a cell",
                "text": "A cell is like a city: some parts build, others deliver, others keep order. Biology trains you to see life in details and in the connections between them."
            },
            {
                "title": "Language of living systems",
                "text": "Living systems save energy, avoid mistakes, and recover after damage. There is a quiet logic to it in every organism."
            },
        ],
    },
    "chemistry": {
        "ru": [
            {
                "title": "Химия вокруг",
                "text": "Химия объясняет, почему металл ржавеет, а чай меняет цвет с лимоном. Это язык превращений, где маленькие частицы создают большие эффекты."
            },
            {
                "title": "Точные превращения",
                "text": "Реакции похожи на диалоги: важно, кто с кем встретился и при каких условиях. Меняя температуру и концентрацию, ты меняешь итог истории."
            },
        ],
        "en": [
            {
                "title": "Chemistry around us",
                "text": "Chemistry explains why metal rusts and tea changes color with lemon. It is the language of transformations where tiny particles create big effects."
            },
            {
                "title": "Precise transformations",
                "text": "Reactions are like dialogues: who meets whom and under which conditions matters. Change the temperature or concentration, and you change the ending."
            },
        ],
    },
    "economics": {
        "ru": [
            {
                "title": "Рынки — это люди",
                "text": "Экономика — не только графики, а решения миллионов людей. Ожидания, страхи и планы превращаются в цены, спрос и предложения."
            },
            {
                "title": "Цена выбора",
                "text": "Каждый выбор имеет стоимость: если ресурсы ушли сюда, значит они не ушли туда. Экономика учит видеть невидимую сторону решений."
            },
        ],
        "en": [
            {
                "title": "Markets are people",
                "text": "Economics is more than charts; it is millions of decisions. Expectations, fears, and plans become prices, demand, and supply."
            },
            {
                "title": "The cost of choice",
                "text": "Every choice has a price: resources used here are not used there. Economics trains you to see the hidden side of decisions."
            },
        ],
    },
    "engineering": {
        "ru": [
            {
                "title": "Искусство компромиссов",
                "text": "Инженерия — это поиск баланса между надежностью, стоимостью и сроками. Хороший проект незаметен, пока работает идеально."
            },
            {
                "title": "Как рождается механизм",
                "text": "Механизм начинается с идеи, потом появляются чертежи, расчеты и прототипы. Детали оживают, когда соединяются в систему."
            },
        ],
        "en": [
            {
                "title": "Art of trade-offs",
                "text": "Engineering is balancing reliability, cost, and time. A great design is invisible until it fails—so the goal is to make it forgettable."
            },
            {
                "title": "How a mechanism is born",
                "text": "A mechanism starts as an idea, then becomes drawings, calculations, and prototypes. Parts come alive when they form a system."
            },
        ],
    },
    "geoscience": {
        "ru": [
            {
                "title": "Слои времени",
                "text": "Геонауки читают планету по слоям пород. Каждый слой хранит историю климата, океанов и движений земли."
            },
            {
                "title": "Планета в движении",
                "text": "Континенты не стоят на месте: они ползут, сталкиваются и расходятся. Земля меняется медленно, но неизбежно."
            },
        ],
        "en": [
            {
                "title": "Layers of time",
                "text": "Geoscience reads the planet through rock layers. Each layer keeps a story of climate, oceans, and the movement of the earth."
            },
            {
                "title": "A moving planet",
                "text": "Continents do not stand still: they drift, collide, and split. The Earth changes slowly, but relentlessly."
            },
        ],
    },
    "humanities": {
        "ru": [
            {
                "title": "Смысл и история",
                "text": "Гуманитарные науки учат видеть, как идеи формируют эпохи. Тексты, картины и речь — это следы людей во времени."
            },
            {
                "title": "Человек и культура",
                "text": "Культура — это разговор поколений. Мы читаем прошлое, чтобы лучше понять себя и свои выборы сегодня."
            },
        ],
        "en": [
            {
                "title": "Meaning and history",
                "text": "Humanities show how ideas shape eras. Texts, art, and speech are human footprints in time."
            },
            {
                "title": "People and culture",
                "text": "Culture is a dialogue between generations. We read the past to understand ourselves today."
            },
        ],
    },
    "it": {
        "ru": [
            {
                "title": "Код как текст",
                "text": "Код — это язык, который читает машина. Хороший код легко читать и человеку: в нем есть ясные имена и понятная логика."
            },
            {
                "title": "Системы и потоки",
                "text": "Современные сервисы — это потоки данных и решений. Даже маленькое изменение может улучшить опыт тысяч людей."
            },
        ],
        "en": [
            {
                "title": "Code as text",
                "text": "Code is a language for machines. Good code is also readable by humans, with clear names and clean logic."
            },
            {
                "title": "Systems and flow",
                "text": "Modern services are streams of data and decisions. A small change can improve the experience of thousands."
            },
        ],
    },
    "math": {
        "ru": [
            {
                "title": "Структуры и закономерности",
                "text": "Математика учит видеть порядок там, где кажется хаос. Формулы — это короткие истории о том, как устроен мир."
            },
            {
                "title": "Точная ясность",
                "text": "В математике важно не просто ответить, а понять, почему ответ верный. Это тренирует ясность мышления."
            },
        ],
        "en": [
            {
                "title": "Structures and patterns",
                "text": "Math helps you see order where chaos seems to rule. Formulas are short stories about how the world works."
            },
            {
                "title": "Precise clarity",
                "text": "In math, it is not enough to answer—you must know why the answer is correct. It builds clarity of thought."
            },
        ],
    },
    "medical": {
        "ru": [
            {
                "title": "Слушать симптомы",
                "text": "Медицина начинается с внимательного наблюдения. Врач ищет закономерности в деталях, чтобы найти причину."
            },
            {
                "title": "Тело как система",
                "text": "Организм — это взаимосвязанная система, где одно изменение влияет на другое. Понимание связей спасает время и жизни."
            },
        ],
        "en": [
            {
                "title": "Listening to symptoms",
                "text": "Medicine starts with attentive observation. A clinician looks for patterns in details to find a cause."
            },
            {
                "title": "The body as a system",
                "text": "The body is a connected system where one change affects another. Understanding links saves time and lives."
            },
        ],
    },
    "physics": {
        "ru": [
            {
                "title": "Язык законов",
                "text": "Физика описывает мир простыми законами и точными измерениями. Она объясняет, почему падают яблоки и светят звезды."
            },
            {
                "title": "Движение и энергия",
                "text": "Движение всегда связано с энергией и сопротивлением. Понимание этих связей помогает строить и рассчитывать."
            },
        ],
        "en": [
            {
                "title": "Language of laws",
                "text": "Physics describes the world with simple laws and precise measurement. It explains why apples fall and stars shine."
            },
            {
                "title": "Motion and energy",
                "text": "Motion always comes with energy and resistance. Understanding these links helps you build and calculate."
            },
        ],
    },
    "psychology": {
        "ru": [
            {
                "title": "Как мы думаем",
                "text": "Психология помогает понять, как формируются решения и привычки. Маленькие изменения в среде меняют поведение."
            },
            {
                "title": "Внимание и память",
                "text": "Память не фотография, а процесс. То, на что мы обращаем внимание, определяет, что мы запомним."
            },
        ],
        "en": [
            {
                "title": "How we think",
                "text": "Psychology helps explain how decisions and habits form. Small changes in environment can shift behavior."
            },
            {
                "title": "Attention and memory",
                "text": "Memory is not a photo, it is a process. What we pay attention to shapes what we remember."
            },
        ],
    },
    "social": {
        "ru": [
            {
                "title": "Общество как сеть",
                "text": "Социальные науки смотрят на связи между людьми. Эти связи создают нормы, правила и общие смыслы."
            },
            {
                "title": "Группы и изменения",
                "text": "Общество постоянно меняется: миграции, технологии, кризисы. Понимание процессов помогает принимать решения."
            },
        ],
        "en": [
            {
                "title": "Society as a network",
                "text": "Social sciences focus on connections between people. Those links create norms, rules, and shared meanings."
            },
            {
                "title": "Groups and change",
                "text": "Society is always shifting: migration, technology, crises. Understanding processes helps decisions."
            },
        ],
    },
    "everyday": {
        "ru": [
            {
                "title": "Повседневные вещи",
                "text": "Обычные слова описывают нашу жизнь: дом, покупки, работа, разговоры. Чем точнее слова, тем яснее мысль."
            },
            {
                "title": "Живая речь",
                "text": "Язык живет в диалогах, шутках и привычках. Запоминая частые слова, ты быстрее понимаешь речь вокруг."
            },
        ],
        "en": [
            {
                "title": "Everyday things",
                "text": "Common words describe daily life: home, shopping, work, conversations. The more precise the words, the clearer the thought."
            },
            {
                "title": "Living speech",
                "text": "Language lives in dialogue, jokes, and habits. Learning frequent words helps you understand speech faster."
            },
        ],
    },
    "personal": {
        "ru": [
            {
                "title": "Личный список",
                "text": "Ты добавил свои слова — значит, они важны именно для тебя. Это лучший способ учить то, что пригодится в жизни."
            },
            {
                "title": "Своя подборка",
                "text": "Личный словарь делает обучение осознанным. Чем ближе слова к твоим интересам, тем легче их запомнить."
            },
        ],
        "en": [
            {
                "title": "Personal list",
                "text": "You added your own words, so they matter to you. This is the best way to learn what you will really use."
            },
            {
                "title": "Your own set",
                "text": "A personal vocabulary makes learning deliberate. The closer words are to your interests, the easier to remember them."
            },
        ],
    },
    "general": {
        "ru": [
            {
                "title": "Небольшая пауза",
                "text": "Небольшая пауза помогает памяти перейти в более устойчивый режим. Просто прочитай этот текст и отдохни взглядом."
            },
            {
                "title": "Фокус и отдых",
                "text": "Смена активности помогает мозгу закрепить новую информацию. Сделай короткий перерыв и возвращайся к тесту."
            },
        ],
        "en": [
            {
                "title": "Short pause",
                "text": "A short pause helps memory move to a more stable mode. Read this text and rest your eyes."
            },
            {
                "title": "Focus and rest",
                "text": "A change of activity helps the brain consolidate new information. Take a short break and return to the test."
            },
        ],
    },
}


def detect_domain(slug: str | None, name: str | None) -> str:
    token = f"{slug or ''} {name or ''}".lower()
    if "agronom" in token or "agricult" in token:
        return "agriculture"
    if "biolog" in token:
        return "biology"
    if "chem" in token:
        return "chemistry"
    if "econom" in token:
        return "economics"
    if "engineering" in token:
        return "engineering"
    if "geo" in token:
        return "geoscience"
    if "humanit" in token:
        return "humanities"
    if token.startswith("it") or " it " in token or "it_" in token:
        return "it"
    if "math" in token:
        return "math"
    if "medical" in token or "biomed" in token:
        return "medical"
    if "nonscientific" in token or "non-scientific" in token:
        return "everyday"
    if "physical" in token or "physics" in token:
        return "physics"
    if "psycholog" in token or "cognitive" in token:
        return "psychology"
    if "social" in token:
        return "social"
    return "general"


def pick_reading_text(domain: str, lang: str, seed_value: int | None) -> dict:
    texts = READING_LIBRARY.get(domain) or READING_LIBRARY["general"]
    lang_key = "en" if lang == "en" else "ru"
    options = texts.get(lang_key) or READING_LIBRARY["general"][lang_key]
    if not options:
        return {"title": "", "text": ""}
    if seed_value is None:
        return random.choice(options)
    return options[seed_value % len(options)]


async def build_reading_block(
    profile_id,
    word_ids: list[int],
    target_lang: str,
    interface_lang: str | None,
    db: AsyncSession,
    seed_value: int | None,
) -> dict | None:
    if not word_ids:
        return None
    result = await db.execute(
        select(Corpus.slug, Corpus.name, func.count(CorpusWordStat.word_id).label("hits"))
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .join(Corpus, Corpus.id == CorpusWordStat.corpus_id)
        .where(
            UserCorpus.profile_id == profile_id,
            UserCorpus.enabled.is_(True),
            CorpusWordStat.word_id.in_(word_ids),
        )
        .group_by(Corpus.slug, Corpus.name)
        .order_by(func.count(CorpusWordStat.word_id).desc(), Corpus.name)
        .limit(1)
    )
    row = result.first()
    corpus_name = None
    domain = "general"
    if row:
        corpus_name = row.name
        domain = detect_domain(row.slug, row.name)
    else:
        custom_result = await db.execute(
            select(UserCustomWord.word_id)
            .where(
                UserCustomWord.profile_id == profile_id,
                UserCustomWord.word_id.in_(word_ids),
                UserCustomWord.target_lang == target_lang,
            )
            .limit(1)
        )
        if custom_result.first():
            domain = "personal"

    chosen = pick_reading_text(domain, interface_lang or "ru", seed_value)
    return {
        "title": chosen.get("title", ""),
        "text": chosen.get("text", ""),
        "corpus_name": corpus_name,
        "domain": domain,
    }


async def fetch_custom_words(
    profile_id,
    source_lang: str,
    target_lang: str,
    limit: int,
    db: AsyncSession,
) -> list[LearnWordOut]:
    if limit <= 0:
        return []
    stmt = (
        select(
            UserCustomWord.word_id,
            Word.lemma,
            UserCustomWord.translation,
            UserCustomWord.created_at,
        )
        .select_from(UserCustomWord)
        .join(Word, Word.id == UserCustomWord.word_id)
        .outerjoin(
            UserWord,
            and_(UserWord.profile_id == profile_id, UserWord.word_id == UserCustomWord.word_id),
        )
        .where(
            UserCustomWord.profile_id == profile_id,
            UserCustomWord.target_lang == target_lang,
            Word.lang == source_lang,
            UserWord.word_id.is_(None),
        )
        .order_by(UserCustomWord.created_at.asc(), UserCustomWord.word_id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return [
        LearnWordOut(
            word_id=row.word_id,
            word=row.lemma,
            translation=row.translation,
            rank=None,
            count=None,
        )
        for row in result.fetchall()
    ]


async def fetch_corpus_words(
    profile_id,
    target_lang: str,
    limit: int,
    exclude_word_ids: list[int],
    db: AsyncSession,
) -> list[LearnWordOut]:
    if limit <= 0:
        return []
    stmt = (
        select(
            Word.id.label("word_id"),
            Word.lemma.label("lemma"),
            func.min(CorpusWordStat.rank).label("rank"),
            func.max(CorpusWordStat.count).label("count"),
        )
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .join(Word, Word.id == CorpusWordStat.word_id)
        .join(
            Translation,
            and_(Translation.word_id == Word.id, Translation.target_lang == target_lang),
        )
        .outerjoin(
            UserWord,
            and_(UserWord.profile_id == profile_id, UserWord.word_id == Word.id),
        )
        .where(UserCorpus.profile_id == profile_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
        .group_by(Word.id, Word.lemma)
        .order_by(func.min(CorpusWordStat.rank).nulls_last(), Word.id)
        .limit(limit)
    )
    if exclude_word_ids:
        stmt = stmt.where(Word.id.notin_(exclude_word_ids))
    result = await db.execute(stmt)
    rows = result.fetchall()
    word_ids = [row.word_id for row in rows]
    translation_map = await fetch_user_translation_map(profile_id, word_ids, target_lang, db)
    results: list[LearnWordOut] = []
    for row in rows:
        translations = translation_map.get(row.word_id, [])
        if not translations:
            continue
        results.append(
            LearnWordOut(
                word_id=row.word_id,
                word=row.lemma,
                translation=sorted(translations)[0],
                rank=row.rank,
                count=row.count,
            )
        )
    return results


async def fetch_learn_words(
    profile_id,
    source_lang: str,
    target_lang: str,
    limit: int,
    db: AsyncSession,
) -> list[LearnWordOut]:
    custom_words = await fetch_custom_words(profile_id, source_lang, target_lang, limit, db)
    remaining = max(0, limit - len(custom_words))
    if remaining == 0:
        return custom_words
    exclude_ids = [item.word_id for item in custom_words]
    corpus_words = await fetch_corpus_words(
        profile_id,
        target_lang,
        remaining,
        exclude_ids,
        db,
    )
    return custom_words + corpus_words


async def fetch_review_words(
    profile_id,
    target_lang: str,
    limit: int,
    now: datetime,
    db: AsyncSession,
) -> list[ReviewWordOut]:
    stmt = (
        select(
            UserWord.word_id,
            Word.lemma,
            UserWord.learned_at,
            UserWord.next_review_at,
            UserWord.stage,
        )
        .select_from(UserWord)
        .join(Word, Word.id == UserWord.word_id)
        .where(
            UserWord.profile_id == profile_id,
            UserWord.next_review_at.is_not(None),
            UserWord.next_review_at <= now,
        )
        .order_by(UserWord.next_review_at, UserWord.word_id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.fetchall()
    word_ids = [row.word_id for row in rows]
    translation_map = await fetch_user_translation_map(profile_id, word_ids, target_lang, db)
    results: list[ReviewWordOut] = []
    for row in rows:
        translations = translation_map.get(row.word_id, [])
        if not translations:
            continue
        results.append(
            ReviewWordOut(
                word_id=row.word_id,
                word=row.lemma,
                translation=sorted(translations)[0],
                learned_at=row.learned_at,
                next_review_at=row.next_review_at,
                stage=row.stage,
            )
        )
    return results


def normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def build_translation_options(translations: list[str]) -> set[str]:
    options: set[str] = set()
    for text in translations:
        for part in re.split(r"[;,/]", text or ""):
            normalized = normalize_text(part)
            if normalized:
                options.add(normalized)
    return options


def edit_distance(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    if len(a) < len(b):
        a, b = b, a
    previous = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i]
        for j, char_b in enumerate(b, start=1):
            insert_cost = current[j - 1] + 1
            delete_cost = previous[j] + 1
            replace_cost = previous[j - 1] + (char_a != char_b)
            current.append(min(insert_cost, delete_cost, replace_cost))
        previous = current
    return previous[-1]


def is_fuzzy_match(answer: str, option: str) -> bool:
    if not answer or not option:
        return False
    if answer == option:
        return True
    if abs(len(answer) - len(option)) > 2:
        return False
    min_len = min(len(answer), len(option))
    if min_len <= 6:
        return edit_distance(answer, option) <= 1
    if min_len <= 8:
        return edit_distance(answer, option) <= 2
    ratio = SequenceMatcher(None, answer, option).ratio()
    return ratio >= 0.88


async def fetch_user_translation_map(
    profile_id,
    word_ids: list[int],
    target_lang: str,
    db: AsyncSession,
) -> dict[int, list[str]]:
    if not word_ids:
        return {}
    mapping: dict[int, list[str]] = {}
    custom_result = await db.execute(
        select(UserCustomWord.word_id, UserCustomWord.translation).where(
            UserCustomWord.profile_id == profile_id,
            UserCustomWord.word_id.in_(word_ids),
            UserCustomWord.target_lang == target_lang,
        )
    )
    for word_id, translation in custom_result.fetchall():
        mapping.setdefault(word_id, []).append(translation)

    remaining = [word_id for word_id in word_ids if word_id not in mapping]
    if not remaining:
        return mapping

    result = await db.execute(
        select(Translation.word_id, Translation.translation).where(
            Translation.word_id.in_(remaining),
            Translation.target_lang == target_lang,
        )
    )
    for word_id, translation in result.fetchall():
        mapping.setdefault(word_id, []).append(translation)
    return mapping


def score_answer(answer: str, translations: list[str]) -> tuple[bool, int, list[str]]:
    normalized = normalize_text(answer or "")
    options = sorted(build_translation_options(translations))
    if not normalized:
        return False, 0, options
    if normalized in options:
        return True, 5, options
    if any(is_fuzzy_match(normalized, option) for option in options):
        return True, 4, options
    return False, 2, options


def sm2_next(
    quality: int,
    repetitions: int,
    interval_days: int,
    ease_factor: float,
    now: datetime,
) -> tuple[int, int, float, datetime]:
    ef = ease_factor or 2.5
    ef = max(1.3, ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
    if quality < 3:
        repetitions = 0
        interval_days = 1
    else:
        if repetitions <= 0:
            interval_days = 1
        elif repetitions == 1:
            interval_days = 6
        else:
            interval_days = max(1, round(interval_days * ef))
        repetitions += 1
    return repetitions, interval_days, ef, now + timedelta(days=interval_days)


async def seed_review_words(
    profile_id,
    limit: int,
    db: AsyncSession,
) -> int:
    stmt = (
        select(Word.id)
        .select_from(CorpusWordStat)
        .join(UserCorpus, UserCorpus.corpus_id == CorpusWordStat.corpus_id)
        .join(Word, Word.id == CorpusWordStat.word_id)
        .outerjoin(UserWord, and_(UserWord.profile_id == profile_id, UserWord.word_id == Word.id))
        .where(UserCorpus.profile_id == profile_id, UserCorpus.enabled.is_(True))
        .where(
            or_(
                UserCorpus.target_word_limit == 0,
                CorpusWordStat.rank <= UserCorpus.target_word_limit,
            )
        )
        .where(UserWord.word_id.is_(None))
        .group_by(Word.id)
        .order_by(func.min(CorpusWordStat.rank).nulls_last(), Word.id)
        .limit(limit)
    )
    result = await db.execute(stmt)
    word_ids = [row[0] for row in result.fetchall()]
    if not word_ids:
        return 0

    now = datetime.now(timezone.utc)
    rows = [
        {
            "profile_id": profile_id,
            "word_id": word_id,
            "status": "learned",
            "stage": 0,
            "repetitions": 0,
            "interval_days": 0,
            "ease_factor": 2.5,
            "learned_at": now,
            "last_review_at": now,
            "next_review_at": now,
            "correct_streak": 0,
            "wrong_streak": 0,
        }
        for word_id in word_ids
    ]
    stmt = insert(UserWord).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["profile_id", "word_id"])
    result = await db.execute(stmt)
    await db.commit()
    return int(result.rowcount or 0)


@router.post("/learn/start", response_model=LearnStartOut)
async def start_learn(
    limit: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LearnStartOut:
    profile, settings = await load_profile_settings(user.id, db)
    batch_size = limit if limit and limit > 0 else settings.learn_batch_size
    if batch_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid batch size")

    words = await fetch_learn_words(
        profile.id,
        profile.native_lang,
        profile.target_lang,
        batch_size,
        db,
    )
    if not words:
        return LearnStartOut(session_id=None, words=[])

    session = StudySession(
        profile_id=profile.id,
        user_id=user.id,
        session_type="learn",
        words_total=len(words),
    )
    db.add(session)
    await db.flush()
    ui_lang_result = await db.execute(
        select(UserProfile.interface_lang).where(UserProfile.user_id == user.id)
    )
    interface_lang = ui_lang_result.scalar_one_or_none() or "ru"
    reading = await build_reading_block(
        profile.id,
        [item.word_id for item in words],
        profile.target_lang,
        interface_lang,
        db,
        session.id,
    )
    await db.commit()

    return LearnStartOut(session_id=session.id, words=words, reading=reading)


@router.post("/learn/submit", response_model=LearnSubmitOut)
async def submit_learn(
    data: LearnSubmitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LearnSubmitOut:
    if not data.words:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No answers")

    profile, _settings = await load_profile_settings(user.id, db)

    word_ids = [item.word_id for item in data.words]
    if len(set(word_ids)) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate word ids")
    translation_map = await fetch_user_translation_map(profile.id, word_ids, profile.target_lang, db)

    session = None
    if data.session_id is not None:
        session_result = await db.execute(
            select(StudySession).where(
                StudySession.id == data.session_id,
                StudySession.user_id == user.id,
                StudySession.profile_id == profile.id,
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    now = datetime.now(timezone.utc)
    words_total = len(data.words)
    words_correct = 0
    results = []
    for item in data.words:
        translations = translation_map.get(item.word_id, [])
        correct, _quality, options = score_answer(item.answer, translations)
        results.append(
            {
                "word_id": item.word_id,
                "correct": correct,
                "correct_answers": options,
            }
        )
        if correct:
            words_correct += 1
    all_correct = words_correct == words_total

    if session is not None:
        session.words_total = words_total
        session.words_correct = words_correct
        session.finished_at = now

    learned = 0
    if all_correct:
        rows = [
            {
                "profile_id": profile.id,
                "user_id": user.id,
                "word_id": item.word_id,
                "status": "learned",
                "stage": 1,
                "repetitions": 1,
                "interval_days": 1,
                "ease_factor": 2.5,
                "learned_at": now,
                "last_review_at": now,
                "next_review_at": now + timedelta(days=1),
                "correct_streak": 1,
                "wrong_streak": 0,
            }
            for item in data.words
        ]
        stmt = insert(UserWord).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["profile_id", "word_id"])
        result = await db.execute(stmt)
        learned = int(result.rowcount or 0)

    await db.commit()

    await log_audit_event(
        "study.learn.submit",
        user_id=user.id,
        meta={"words_total": words_total, "words_correct": words_correct},
        request=request,
        db=db,
    )

    return LearnSubmitOut(
        all_correct=all_correct,
        words_total=words_total,
        words_correct=words_correct,
        learned=learned,
        results=results,
    )


@router.post("/review/start", response_model=ReviewStartOut)
async def start_review(
    limit: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewStartOut:
    profile, settings = await load_profile_settings(user.id, db)
    batch_size = limit if limit and limit > 0 else settings.daily_review_words
    if batch_size <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid batch size")

    now = datetime.now(timezone.utc)
    words = await fetch_review_words(profile.id, profile.target_lang, batch_size, now, db)
    if not words:
        return ReviewStartOut(session_id=None, words=[])

    session = StudySession(
        profile_id=profile.id,
        user_id=user.id,
        session_type="review",
        words_total=len(words),
    )
    db.add(session)
    await db.flush()
    await db.commit()

    return ReviewStartOut(session_id=session.id, words=words)


@router.post("/review/submit", response_model=ReviewSubmitOut)
async def submit_review(
    data: ReviewSubmitRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewSubmitOut:
    if not data.words:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No answers")

    profile, _settings = await load_profile_settings(user.id, db)

    word_ids = [item.word_id for item in data.words]
    if len(set(word_ids)) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Duplicate word ids")

    session = None
    if data.session_id is not None:
        session_result = await db.execute(
            select(StudySession).where(
                StudySession.id == data.session_id,
                StudySession.user_id == user.id,
                StudySession.profile_id == profile.id,
            )
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    rows_result = await db.execute(
        select(UserWord).where(UserWord.profile_id == profile.id, UserWord.word_id.in_(word_ids))
    )
    user_words = {row.word_id: row for row in rows_result.scalars().all()}
    if len(user_words) != len(word_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Word not found")

    translation_map = await fetch_user_translation_map(profile.id, word_ids, profile.target_lang, db)

    now = datetime.now(timezone.utc)
    words_total = len(data.words)
    words_correct = 0
    words_incorrect = 0
    results = []

    review_events = []
    for item in data.words:
        current = user_words[item.word_id]
        translations = translation_map.get(item.word_id, [])
        correct, quality, options = score_answer(item.answer, translations)
        if item.quality is not None:
            try:
                provided_quality = int(item.quality)
            except (TypeError, ValueError):
                provided_quality = quality
            else:
                provided_quality = max(0, min(5, provided_quality))
            if not correct and provided_quality > 2:
                provided_quality = 2
            quality = provided_quality
        results.append(
            {
                "word_id": item.word_id,
                "correct": correct,
                "correct_answers": options,
            }
        )
        repetitions = current.repetitions or 0
        interval_days = current.interval_days or 0
        ease_factor = current.ease_factor or 2.5
        repetitions, interval_days, ease_factor, next_review_at = sm2_next(
            quality, repetitions, interval_days, ease_factor, now
        )
        current.repetitions = repetitions
        current.interval_days = interval_days
        current.ease_factor = ease_factor
        current.stage = repetitions
        current.last_review_at = now
        current.next_review_at = next_review_at
        if correct:
            current.correct_streak = (current.correct_streak or 0) + 1
            current.wrong_streak = 0
            if current.status not in {"known", "learned"}:
                current.status = "learned"
            words_correct += 1
            review_events.append(
                ReviewEvent(
                    profile_id=profile.id,
                    user_id=user.id,
                    word_id=current.word_id,
                    result="correct",
                )
            )
        else:
            current.correct_streak = 0
            current.wrong_streak = (current.wrong_streak or 0) + 1
            words_incorrect += 1
            review_events.append(
                ReviewEvent(
                    profile_id=profile.id,
                    user_id=user.id,
                    word_id=current.word_id,
                    result="wrong",
                )
            )

    if session is not None:
        session.words_total = words_total
        session.words_correct = words_correct
        session.finished_at = now

    if review_events:
        db.add_all(review_events)

    await db.commit()

    await log_audit_event(
        "study.review.submit",
        user_id=user.id,
        meta={
            "words_total": words_total,
            "words_correct": words_correct,
            "words_incorrect": words_incorrect,
        },
        request=request,
        db=db,
    )

    return ReviewSubmitOut(
        words_total=words_total,
        words_correct=words_correct,
        words_incorrect=words_incorrect,
        results=results,
    )


@router.post("/review/seed", response_model=ReviewSeedOut)
async def seed_review(
    limit: int = 10,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReviewSeedOut:
    profile, _settings = await load_profile_settings(user.id, db)
    if limit <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid limit")
    seeded = await seed_review_words(profile.id, limit, db)
    return ReviewSeedOut(seeded=seeded)
