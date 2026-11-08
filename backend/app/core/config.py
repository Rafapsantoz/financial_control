from pathlib import Path
from typing import List
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_DB_FILE = PROJECT_ROOT / "financial.db"
DEFAULT_DB_URL = f"sqlite+aiosqlite:///{DEFAULT_DB_FILE.as_posix()}"


class Settings(BaseSettings):
    PROJECT_NAME: str = "RPsec Financeiro API"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Credentials & Tokens
    API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"

    # Database Settings
    USE_SQLITE: bool = True
    SQLITE_DB_PATH: str = str(DEFAULT_DB_FILE)
    DATABASE_URL: str = DEFAULT_DB_URL

    # CORS Origins
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(
        env_file=(
            str(PROJECT_ROOT / "ENV" / ".env"),
            str(PROJECT_ROOT / ".env"),
            str(BACKEND_DIR / ".env"),
            ".env",
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def sync_gemini_keys(self) -> "Settings":
        key = self.API_KEY or self.GEMINI_API_KEY
        self.API_KEY = key
        self.GEMINI_API_KEY = key
        return self


settings = Settings()
