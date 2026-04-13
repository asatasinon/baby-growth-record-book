from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import check_database_ready
from app.core.response import success

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
async def live() -> dict:
    return success({"status": "live"})


@router.get("/ready")
async def ready() -> JSONResponse:
    settings = get_settings()
    db_ok, db_error = await check_database_ready()

    storage_ready = bool(
        settings.oss_endpoint
        and settings.oss_bucket
        and settings.oss_access_key
        and settings.oss_secret_key
    )

    all_ready = db_ok and storage_ready
    status_code = 200 if all_ready else 503
    code = "OK" if all_ready else "INTERNAL_ERROR"

    payload = {
        "database": {"ready": db_ok, "error": db_error},
        "object_storage": {"ready": storage_ready},
    }

    return JSONResponse(
        status_code=status_code,
        content={"code": code, "message": "success" if all_ready else "not ready", "data": payload},
    )
