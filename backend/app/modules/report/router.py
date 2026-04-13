from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import (
    assert_baby_belongs_family,
    assert_family_access,
    assert_family_write_access,
)
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import now_ms
from app.models.export import ExportTask
from app.models.task import TaskJob
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/reports", tags=["reports"])


class ExportTaskCreateRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    report_type: Literal["daily", "weekly", "monthly", "custom"]
    date_from: int
    date_to: int


@router.post("/export")
async def create_export_task(
    payload: ExportTaskCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(payload.family_id)
    baby_id_int = to_db_id(payload.baby_id)

    await assert_family_write_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    task = ExportTask(
        family_id=family_id_int,
        baby_id=baby_id_int,
        report_type=payload.report_type,
        date_from=payload.date_from,
        date_to=payload.date_to,
        status="pending",
        object_key=None,
        download_url=None,
        expires_at=None,
        error_message=None,
        requested_by=current_user.user_id,
    )
    db.add(task)
    await db.flush()
    db.add(
        TaskJob(
            job_type="export_report",
            payload={
                "task_id": task.id,
                "family_id": task.family_id,
                "baby_id": task.baby_id,
            },
            status="pending",
            retry_count=0,
            max_retries=3,
            run_after=now_ms(),
            locked_at=None,
            locked_by=None,
            error_message=None,
        )
    )
    await db.commit()

    return success(
        {
            "id": to_api_id(task.id),
            "status": task.status,
            "download_url": task.download_url,
            "expires_at": task.expires_at,
        }
    )


@router.get("/exports")
async def list_export_tasks(
    family_id: Annotated[IdStr, Query()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)

    tasks = await db.scalars(
        select(ExportTask)
        .where(ExportTask.family_id == family_id_int)
        .order_by(ExportTask.created_at.desc(), ExportTask.id.desc())
    )

    payload = [
        {
            "id": to_api_id(item.id),
            "family_id": to_api_id(item.family_id),
            "baby_id": to_api_id(item.baby_id),
            "report_type": item.report_type,
            "status": item.status,
            "date_from": item.date_from,
            "date_to": item.date_to,
            "download_url": item.download_url,
            "expires_at": item.expires_at,
        }
        for item in tasks
    ]
    return success(payload)


@router.get("/exports/{task_id}")
async def get_export_task(
    task_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await db.get(ExportTask, to_db_id(task_id))
    if task is None:
        raise AppError("NOT_FOUND", "export task not found", status_code=404)

    await assert_family_access(db, family_id=task.family_id, user_id=current_user.user_id)

    return success(
        {
            "id": to_api_id(task.id),
            "status": task.status,
            "download_url": task.download_url,
            "expires_at": task.expires_at,
        }
    )
