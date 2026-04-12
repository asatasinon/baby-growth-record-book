from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_env: str = Field(default="local", alias="APP_ENV")
    app_secret: str = Field(default="replace_me", alias="APP_SECRET")
    jwt_secret: str = Field(default="replace_me", alias="JWT_SECRET")

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="baby_growth", alias="DB_NAME")
    db_user: str = Field(default="baby_growth", alias="DB_USER")
    db_password: str = Field(default="baby_growth", alias="DB_PASSWORD")

    # CORS：生产环境通过环境变量覆盖为具体域名列表，用逗号分隔
    cors_allow_origins: str = Field(default="*", alias="CORS_ALLOW_ORIGINS")

    object_storage_endpoint: str | None = Field(default=None, alias="OBJECT_STORAGE_ENDPOINT")
    object_storage_bucket: str | None = Field(default=None, alias="OBJECT_STORAGE_BUCKET")
    object_storage_access_key: str | None = Field(default=None, alias="OBJECT_STORAGE_ACCESS_KEY")
    object_storage_secret_key: str | None = Field(default=None, alias="OBJECT_STORAGE_SECRET_KEY")

    llm_base_url: str | None = Field(default=None, alias="LLM_BASE_URL")
    llm_api_key: str | None = Field(default=None, alias="LLM_API_KEY")

    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    api_reload: bool = Field(default=True, alias="API_RELOAD")
    api_log_level: str = Field(default="info", alias="API_LOG_LEVEL")
    api_workers: int = Field(default=1, alias="API_WORKERS")

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    @property
    def db_dsn(self) -> str:
        return (
            f"postgresql+psycopg://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def db_dsn_async(self) -> str:
        return (
            f"postgresql+psycopg_async://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    @property
    def cors_origins(self) -> list[str]:
        if self.cors_allow_origins == "*":
            return ["*"]
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    @property
    def is_local(self) -> bool:
        return self.app_env == "local"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
