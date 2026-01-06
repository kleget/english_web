import os


def get_env(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value else default


def get_env_list(name: str) -> set[str]:
    value = os.getenv(name, "")
    items = [item.strip().lower() for item in value.split(",") if item.strip()]
    return set(items)


def get_env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


DATABASE_URL = get_env("DATABASE_URL", "postgresql+asyncpg://english:english@localhost:5432/english_web")
REDIS_URL = get_env("REDIS_URL", "redis://localhost:6379/0")
JWT_SECRET = get_env("JWT_SECRET", "change-me")
JWT_ALGORITHM = get_env("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(get_env("JWT_EXPIRE_MINUTES", "1440"))
APP_BASE_URL = get_env("APP_BASE_URL", "http://localhost:3000")
API_BASE_URL = get_env(
    "API_BASE_URL",
    os.getenv("NEXT_PUBLIC_API_BASE") or "http://localhost:8000",
)
ADMIN_EMAILS = get_env_list("ADMIN_EMAILS")
ADMIN_TELEGRAM_CHAT_IDS = get_env_list("ADMIN_TELEGRAM_CHAT_IDS")
SMTP_HOST = get_env("SMTP_HOST", "")
SMTP_PORT = int(get_env("SMTP_PORT", "587"))
SMTP_USER = get_env("SMTP_USER", "")
SMTP_PASSWORD = get_env("SMTP_PASSWORD", "")
SMTP_FROM = get_env("SMTP_FROM", "")
SMTP_TLS = get_env_bool("SMTP_TLS", True)
TELEGRAM_BOT_TOKEN = get_env("TELEGRAM_BOT_TOKEN", "")
