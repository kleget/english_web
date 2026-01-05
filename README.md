# English Web

A local-first language learning web app (FastAPI + Postgres + Next.js).
Focus: learn and review vocabulary with spaced repetition, corpora, and custom words.

## Features
- Auth, profile, interface language (ru/en), light/dark theme.
- Onboarding: choose native/target language, corpora, word limits, daily pace.
- Learn flow: cards -> short reading -> test with fuzzy matching.
- Review flow: SRS scheduling with quality-based updates.
- Custom words: add/edit/delete/import from "word - translation".
- Dashboard stats: daily counts and a learned series chart.
- Weak words stats and sorting.

## Repo layout
- `api/` FastAPI API, async SQLAlchemy, Alembic.
- `web/` Next.js UI (app router).
- `infra/` Docker Compose for Postgres/Redis.
- `scripts/` helper scripts (import and demo flows).

## Requirements
- Python 3.11+
- Node.js 18+
- Docker Desktop (recommended for Postgres/Redis)

## Quick start (local)
1. Copy env file:
   - Windows (cmd): `copy .env.example .env`
   - macOS/Linux: `cp .env.example .env`
2. Start infra:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
3. API:
   ```bash
   cd api
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   alembic upgrade head
   uvicorn app.main:app --reload
   ```
   macOS/Linux activate:
   ```bash
   source .venv/bin/activate
   ```
4. Import SQLite data:
   ```bash
   python scripts/import_sqlite.py --sqlite-dir E:\Code\english_project\database
   ```
   (use any folder with your `.db` files)
5. Web:
   ```bash
   cd web
   npm install
   npm run dev
   ```
6. Open http://localhost:3000

## Demo scripts
- `scripts/onboarding_demo.ps1` - register/login + onboarding + optional known words import.
- `scripts/dashboard_demo.bat` - login + dashboard.
- `scripts/learn_demo.bat` / `scripts/review_demo.bat` - quick learn/review flows.

## Environment
```
DATABASE_URL=postgresql+asyncpg://english:english@localhost:5432/english_web
REDIS_URL=redis://localhost:6379/0
API_HOST=0.0.0.0
API_PORT=8000
NEXT_PUBLIC_API_BASE=http://localhost:8000
JWT_SECRET=change-me
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=1440
```

## Notes
- Postgres data is stored in the Docker volume `db_data` (see `infra/docker-compose.yml`).
- Default API: http://127.0.0.1:8000
- Default Web: http://127.0.0.1:3000
