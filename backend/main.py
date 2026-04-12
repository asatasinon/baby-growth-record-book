import uvicorn

from app.core.config import get_settings


def main() -> None:
    settings = get_settings()
    workers = settings.api_workers if not settings.api_reload else 1

    uvicorn.run(
        "app.main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.api_reload,
        log_level=settings.api_log_level,
        workers=workers,
    )


if __name__ == "__main__":
    main()
