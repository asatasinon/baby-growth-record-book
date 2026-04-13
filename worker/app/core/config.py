from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = Field(default="local", alias="APP_ENV")
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="baby_growth", alias="DB_NAME")
    db_user: str = Field(default="baby_growth", alias="DB_USER")
    db_password: str = Field(default="baby_growth", alias="DB_PASSWORD")
    poll_interval_seconds: int = Field(default=5, alias="POLL_INTERVAL_SECONDS")
    worker_id: str = Field(default="worker-1", alias="WORKER_ID")

    oss_endpoint: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OSS_ENDPOINT", "OBJECT_STORAGE_ENDPOINT"),
    )
    oss_bucket: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OSS_BUCKET", "OBJECT_STORAGE_BUCKET"),
    )
    oss_access_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OSS_ACCESS_KEY", "OBJECT_STORAGE_ACCESS_KEY"),
    )
    oss_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OSS_SECRET_KEY", "OBJECT_STORAGE_SECRET_KEY"),
    )

    llm_base_url: str | None = Field(default=None, alias="LLM_BASE_URL")
    llm_api_key: str | None = Field(default=None, alias="LLM_API_KEY")
    llm_model: str | None = Field(default="gpt-4o-mini", alias="LLM_MODEL")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def db_dsn(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
