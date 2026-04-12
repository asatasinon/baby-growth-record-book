from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.db import close_db, init_db
from app.core.errors import register_exception_handlers
from app.core.logging import setup_logging


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    setup_logging()
    settings = get_settings()
    init_db(settings.db_dsn_async)
    yield
    await close_db()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Baby Growth Record API",
        version="0.1.0",
        lifespan=lifespan,
        # 非 local 环境关闭 Swagger UI，避免暴露接口信息
        docs_url="/api/docs" if settings.is_local else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.is_local else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()


def run() -> FastAPI:
    return app
