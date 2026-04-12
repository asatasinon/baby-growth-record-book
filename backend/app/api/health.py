from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.db import check_database_ready
from app.core.response import success

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def live() -> dict:
    return success({"status": "live"})


@router.get("/ready")
def ready() -> JSONResponse:
    settings = get_settings()
    db_ok, db_error = check_database_ready(settings.db_dsn)

    storage_ready = bool(
        settings.object_storage_endpoint
        and settings.object_storage_bucket
        and settings.object_storage_access_key
        and settings.object_storage_secret_key
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
