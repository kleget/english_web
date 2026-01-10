"""Import translations-only data from english_project SQLite databases into Postgres."""

from __future__ import annotations

import argparse
import asyncio
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Iterable

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

BASE_DIR = Path(__file__).resolve().parents[1]
API_DIR = BASE_DIR / "api"
sys.path.append(str(API_DIR))

from app.db.session import AsyncSessionLocal  # noqa: E402
from app.models import Corpus, CorpusWordStat, Translation, Word  # noqa: E402

SKIP_FILES = {"translations_cache.db", "delete.db"}
LATIN_RE = re.compile(r"[A-Za-z]")
CYRILLIC_RE = re.compile(r"[\u0400-\u04FF]")
LANGS = {"ru", "en"}


def detect_lang(text: str) -> str | None:
    if not text:
        return None
    latin = len(LATIN_RE.findall(text))
    cyrillic = len(CYRILLIC_RE.findall(text))
    if latin == 0 and cyrillic == 0:
        return None
    if latin > cyrillic:
        return "en"
    if cyrillic > latin:
        return "ru"
    return None


def chunked(items: Iterable, size: int) -> Iterable[list]:
    batch = []
    for item in items:
        batch.append(item)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def load_mapping(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sqlite_tables(conn: sqlite3.Connection) -> list[str]:
    cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
    return [row[0] for row in cursor.fetchall()]


def read_translations(conn: sqlite3.Connection) -> list[tuple[str, int, str]]:
    cursor = conn.execute("SELECT word, count, translation FROM translations")
    return [
        (row[0], int(row[1]), row[2])
        for row in cursor.fetchall()
        if row[2] and str(row[2]).strip()
    ]


async def ensure_corpus(session, slug: str, name: str) -> int:
    stmt = (
        insert(Corpus)
        .values(
            slug=slug,
            name=name,
        )
        .on_conflict_do_nothing(index_elements=["slug"])
    )
    await session.execute(stmt)
    result = await session.execute(select(Corpus.id).where(Corpus.slug == slug))
    return result.scalar_one()


async def ensure_words(session, lemmas: list[str], lang: str) -> None:
    for batch in chunked(lemmas, 1000):
        rows = [{"lemma": lemma, "lang": lang} for lemma in batch]
        stmt = insert(Word).values(rows)
        stmt = stmt.on_conflict_do_nothing(index_elements=["lemma", "lang"])
        await session.execute(stmt)


async def fetch_word_ids(session, lemmas: list[str], lang: str) -> dict[str, int]:
    mapping: dict[str, int] = {}
    for batch in chunked(lemmas, 1000):
        result = await session.execute(
            select(Word.id, Word.lemma).where(Word.lang == lang, Word.lemma.in_(batch))
        )
        for word_id, lemma in result.fetchall():
            mapping[lemma] = word_id
    return mapping


async def upsert_corpus_stats(session, corpus_id: int, word_counts: list[tuple[str, int]], word_id_map: dict[str, int]):
    rows = []
    for rank, (lemma, count) in enumerate(word_counts, start=1):
        word_id = word_id_map.get(lemma)
        if word_id is None:
            continue
        rows.append(
            {
                "corpus_id": corpus_id,
                "word_id": word_id,
                "count": count,
                "rank": rank,
            }
        )
        if len(rows) >= 1000:
            stmt = insert(CorpusWordStat).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["corpus_id", "word_id"],
                set_={"count": stmt.excluded.count, "rank": stmt.excluded.rank},
            )
            await session.execute(stmt)
            rows = []

    if rows:
        stmt = insert(CorpusWordStat).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["corpus_id", "word_id"],
            set_={"count": stmt.excluded.count, "rank": stmt.excluded.rank},
        )
        await session.execute(stmt)


async def upsert_translations(
    session,
    translations: list[tuple[str, int, str]],
    word_id_map: dict[str, int],
    target_lang: str,
):
    rows = []
    for lemma, _count, translation in translations:
        word_id = word_id_map.get(lemma)
        if word_id is None:
            continue
        rows.append(
            {
                "word_id": word_id,
                "target_lang": target_lang,
                "translation": translation,
                "source": "sqlite",
            }
        )
        if len(rows) >= 1000:
            stmt = insert(Translation).values(rows)
            stmt = stmt.on_conflict_do_nothing(
                index_elements=["word_id", "target_lang", "translation"]
            )
            await session.execute(stmt)
            rows = []

    if rows:
        stmt = insert(Translation).values(rows)
        stmt = stmt.on_conflict_do_nothing(
            index_elements=["word_id", "target_lang", "translation"]
        )
        await session.execute(stmt)


def build_pairs(
    rows: list[tuple[str, int, str]],
    fallback_pair: tuple[str, str] | None,
) -> tuple[list[tuple[str, str, int]], int]:
    pairs: list[tuple[str, str, int]] = []
    unknown = 0
    for word, count, translation in rows:
        left = str(word).strip()
        right = str(translation).strip()
        if not left or not right:
            continue
        source_lang = detect_lang(left)
        target_lang = detect_lang(right)
        if source_lang in LANGS and target_lang in LANGS and source_lang != target_lang:
            if source_lang == "ru":
                pairs.append((left, right, count))
            else:
                pairs.append((right, left, count))
            continue

        unknown += 1
        if not fallback_pair:
            continue
        fallback_source, fallback_target = fallback_pair
        if fallback_source == "ru" and fallback_target == "en":
            pairs.append((left, right, count))
        elif fallback_source == "en" and fallback_target == "ru":
            pairs.append((right, left, count))
    return pairs, unknown


async def import_database(db_path: Path, mapping: dict) -> None:
    slug = db_path.stem
    if slug not in mapping:
        print(f"Skip {slug}: missing in import_map.json")
        return

    meta = mapping[slug]
    name = meta.get("name", slug)
    fallback_source = meta.get("source_lang", "en")
    fallback_target = meta.get("target_lang", "ru")
    fallback_pair = (fallback_source, fallback_target)

    conn = sqlite3.connect(db_path)
    try:
        tables = sqlite_tables(conn)
        if "translations" not in tables:
            print(f"Skip {slug}: no translations table")
            return

        translations = read_translations(conn)
        if not translations:
            print(f"Skip {slug}: empty translations table")
            return

        pairs, unknown = build_pairs(translations, fallback_pair)
        if not pairs:
            print(f"Skip {slug}: no ru/en pairs found")
            return

        ru_counts: dict[str, int] = {}
        en_counts: dict[str, int] = {}
        ru_lemmas: set[str] = set()
        en_lemmas: set[str] = set()
        for ru_word, en_word, count in pairs:
            ru_lemmas.add(ru_word)
            en_lemmas.add(en_word)
            ru_counts[ru_word] = max(ru_counts.get(ru_word, 0), count)
            en_counts[en_word] = max(en_counts.get(en_word, 0), count)

        ru_word_counts = sorted(ru_counts.items(), key=lambda item: (-item[1], item[0]))
        en_word_counts = sorted(en_counts.items(), key=lambda item: (-item[1], item[0]))

        ru_translations = {(ru_word, en_word) for ru_word, en_word, _count in pairs}
        en_translations = {(en_word, ru_word) for ru_word, en_word, _count in pairs}

        async with AsyncSessionLocal() as session:
            corpus_id = await ensure_corpus(session, slug, name)
            await session.commit()

            await session.execute(
                delete(CorpusWordStat).where(CorpusWordStat.corpus_id == corpus_id)
            )
            await session.commit()

            for source_lang, target_lang, lemmas_set, word_counts, pair_set in (
                ("ru", "en", ru_lemmas, ru_word_counts, ru_translations),
                ("en", "ru", en_lemmas, en_word_counts, en_translations),
            ):
                if not lemmas_set:
                    continue
                lemmas = sorted(lemmas_set)
                translations_rows = [
                    (lemma, 0, translation) for lemma, translation in sorted(pair_set)
                ]

                await ensure_words(session, lemmas, source_lang)
                await session.commit()

                word_id_map = await fetch_word_ids(session, lemmas, source_lang)

                await upsert_corpus_stats(session, corpus_id, word_counts, word_id_map)
                await session.commit()

                await upsert_translations(session, translations_rows, word_id_map, target_lang)
                await session.commit()

            total_words = len(ru_word_counts) + len(en_word_counts)
            total_translations = len(ru_translations) + len(en_translations)
            print(f"Imported {slug}: {total_words} words, {total_translations} translations")
        if unknown:
            print(f"Note {slug}: {unknown} rows with unknown language direction")
    finally:
        conn.close()


async def run(sqlite_dir: Path, map_path: Path) -> None:
    mapping = load_mapping(map_path)
    for db_path in sorted(sqlite_dir.glob("*.db")):
        if db_path.name in SKIP_FILES:
            continue
        await import_database(db_path, mapping)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--sqlite-dir",
        type=Path,
        default=Path("E:/Code/english_project/database"),
    )
    parser.add_argument(
        "--map",
        type=Path,
        default=Path("scripts/import_map.json"),
    )
    args = parser.parse_args()
    asyncio.run(run(args.sqlite_dir, args.map))


if __name__ == "__main__":
    main()
