from fastapi import APIRouter

from app.core.response import success

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/families")
def admin_list_families() -> dict:
    return success([])


@router.get("/babies")
def admin_list_babies() -> dict:
    return success([])


@router.get("/events")
def admin_list_events() -> dict:
    return success([])
