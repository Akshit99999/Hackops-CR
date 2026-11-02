from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Hackops-CR API"
    app_env: str = "development"
    database_url: str = "sqlite:///./data/hackops.db"
    upload_dir: Path = Path("./data/uploads")
    redis_url: str = "redis://localhost:6379/0"
    cors_origins: str = "http://127.0.0.1:3000,http://localhost:3000"
    max_upload_bytes: int = 10 * 1024 * 1024
    external_api_timeout_seconds: float = 8.0

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
