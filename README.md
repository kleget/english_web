# Recallio

Веб‑сервис для изучения иностранных языков: карточки, тесты и интервальные повторения.
Проект рассчитан на локальную разработку, но структура готова к разворачиванию на VPS.

## Что это умеет
- Регистрация и вход, выбор языка интерфейса (ru/en), светлая/тёмная тема.
- Онбординг: выбор направления (родной/изучаемый), корпусов, лимитов и темпа.
- Учёба: карточки → короткий текст → тест с “fuzzy”‑проверкой ответов.
- Повторение: интервальные повторения по SRS (SM‑2).
- Пользовательские слова: добавление/редактирование/удаление/импорт.
- Дашборд: статистика, сколько знаешь, график по дням.
- Слабые слова: сортировки по ошибкам, точности и алфавиту.

## Технологии
- Backend: FastAPI, SQLAlchemy (async), Alembic, Postgres, asyncpg
- Frontend: Next.js (App Router)
- Инфраструктура: Docker Compose (Postgres, Redis)

## Архитектура на уровне сервиса
- `api/`: FastAPI API + бизнес‑логика обучения.
- `web/`: Next.js UI (страницы, стили, состояние интерфейса).
- `infra/`: docker‑compose с Postgres/Redis.
- `scripts/`: импорты и демо‑скрипты.

## Учебные профили
Каждая пара языков хранится как отдельный учебный профиль.  
Это позволяет переключать направление (ru→en / en→ru) без потери прогресса.
Активный профиль выбирается в онбординге.

## Структура репозитория
```
english_web/
  api/
    app/
      api/            эндпоинты
      core/           конфиги/безопасность
      db/             база и session
      models/         SQLAlchemy модели
      schemas/        Pydantic схемы
    alembic/          миграции
  web/
    app/              Next.js страницы
    styles/           глобальные стили
  infra/
    docker-compose.yml
  scripts/
    import_sqlite.py  импорт из SQLite
    onboarding_demo.ps1
    learn_demo.bat / learn_demo.ps1
    review_demo.bat / review_demo.ps1
    dashboard_demo.bat
```

## Требования
- Python 3.11+
- Node.js 18+
- Docker Desktop (для Postgres/Redis)

## Быстрый старт (локально)
1) Скопируй env:
   - Windows (cmd): `copy .env.example .env`
   - macOS/Linux: `cp .env.example .env`

2) Подними БД:
```bash
docker compose -f infra/docker-compose.yml up -d
```

3) API:
```bash
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```
macOS/Linux:
```bash
source .venv/bin/activate
```

4) Импорт SQLite:
```bash
python scripts/import_sqlite.py --sqlite-dir E:\Code\english_project\database
```
(папка может быть любой, где лежат твои `.db` файлы)

5) Web:
```bash
cd web
npm install
npm run dev
```

6) Открой: http://localhost:3000

## Переменные окружения
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

## Как пользоваться
1) Авторизуйся (страница `/auth`).
2) Пройди онбординг (`/onboarding`):
   - выбери направление (native/target),
   - выбери корпуса и лимиты слов,
   - задай темп (новые/повторы/пачка).
3) Учёба: `/learn`
4) Повторы: `/review`
5) Свои слова: `/custom-words`
6) Статистика слабых слов: `/stats`
7) Профиль и настройки: `/profile`, `/settings`

## Формат импорта пользовательских слов
Одна строка = одно слово:
```
слово - перевод
cat - кошка
```
Разделитель: дефис `-` (пробелы игнорируются).

## Миграции
Из папки `api/`:
```bash
alembic upgrade head
```
Новая миграция:
```bash
alembic revision --autogenerate -m "описание"
```

## Демо‑скрипты
- `scripts/onboarding_demo.ps1` – регистрация/вход + онбординг.
- `scripts/dashboard_demo.bat` – тест дашборда.
- `scripts/learn_demo.bat` / `scripts/review_demo.bat` – учёба/повтор.

## Где хранятся данные Postgres
В Docker‑томе `db_data` (см. `infra/docker-compose.yml`).
Проверить путь:
```bash
docker volume inspect db_data
```

## Частые вопросы
**Ошибка “Onboarding required”**  
Пройди онбординг: `/onboarding`.

**Нет слов для повторения**  
Проверь, что есть выученные слова и пришло время повторения.

## Лицензия
Пока не задана. Если нужна – добавим отдельным файлом.
