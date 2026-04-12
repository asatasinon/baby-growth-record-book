from typing import Annotated

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/reports", tags=["reports"])


class ExportTaskCreateRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    report_type: str
    date_from: int
    date_to: int


@router.post("/export")
def create_export_task(payload: ExportTaskCreateRequest) -> dict:
    return success(
        {
            "id": "60001",
            "status": "pending",
            "download_url": None,
            "expires_at": None,
            **payload.model_dump(),
        }
    )


@router.get("/exports")
def list_export_tasks(family_id: Annotated[IdStr, Query()]) -> dict:
    return success(
        [
            {
                "id": "60001",
                "family_id": family_id,
                "status": "pending",
                "report_type": "daily",
            }
        ]
    )


@router.get("/exports/{task_id}")
def get_export_task(task_id: Annotated[IdStr, Path()]) -> dict:
    return success(
        {
            "id": task_id,
            "status": "running",
            "download_url": None,
            "expires_at": None,
        }
    )
