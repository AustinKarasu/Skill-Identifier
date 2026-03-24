from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR.parent / ".env")
load_dotenv(BASE_DIR.parent / ".env.local")


def get_database_url() -> str:
    database_url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL") or ""
    if not database_url:
        raise RuntimeError("A remote database URL is required. Set SUPABASE_DB_URL or DATABASE_URL.")
    if database_url.startswith("sqlite"):
        raise RuntimeError("SQLite/local file storage is disabled. Configure a remote Postgres database.")
    return database_url


DATABASE_URL = get_database_url()
USE_REMOTE_DB = DATABASE_URL.startswith("postgresql") or DATABASE_URL.startswith("postgres://")

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
RECAPTCHA_SECRET_KEY = os.getenv("RECAPTCHA_SECRET_KEY", "")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "SkillSenseAI")
RESUME_PARSER_PROVIDER = os.getenv("RESUME_PARSER_PROVIDER", "local")
RESUME_PARSER_API_URL = os.getenv("RESUME_PARSER_API_URL", "")
RESUME_PARSER_API_KEY = os.getenv("RESUME_PARSER_API_KEY", "")
