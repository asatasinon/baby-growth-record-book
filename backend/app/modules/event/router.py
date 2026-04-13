from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Header, Path, Query
from pydantic import BaseModel
from sqlalchemy import Select, select
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
from app.core.time_utils import day_start_ms, now_ms
from app.models.audit import OperationLog
from app.models.event import GrowthEvent
from app.models.task import TaskJob
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/events", tags=["events"])


class EventCreateRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    event_type: Literal[
        "feeding",
        "excretion",
        "measurement",
        "sleep",
        "medication",
        "vaccine",
        "milestone",
    ]
    occurred_at: int
    start_at: int | None = None
    end_at: int | None = None
    timezone: str = "Asia/Shanghai"
    notes: str | None = None
    payload: dict[str, Any]


class EventUpdateRequest(BaseModel):
    occurred_at: int | None = None
    start_at: int | None = None
    end_at: int | None = None
    notes: str | None = None
    payload: dict[str, Any] | None = None


def _event_to_payload(event: GrowthEvent) -> dict[str, Any]:
    return {
        "id": to_api_id(event.id),
        "family_id": to_api_id(event.family_id),
        "baby_id": to_api_id(event.baby_id),
        "event_type": event.event_type,
        "occurred_at": event.occurred_at,
        "start_at": event.start_at,
        "end_at": event.end_at,
        "timezone": event.timezone,
        "notes": event.notes,
        "payload": event.payload_snapshot,
        "status": event.status,
    }


def _enqueue_aggregate_daily(
    *,
    db: AsyncSession,
    family_id: int,
    baby_id: int,
    dates: set[int],
) -> None:
    run_after = now_ms()
    normalized_dates = sorted(dates)
    db.add(
        TaskJob(
            job_type="aggregate_daily",
            payload={
                "family_id": family_id,
                "baby_id": baby_id,
                "dates": normalized_dates,
            },
            status="pending",
            retry_count=0,
            max_retries=3,
            run_after=run_after,
            locked_at=None,
            locked_by=None,
            error_message=None,
        )
    )


def _add_operation_log(
    *,
    db: AsyncSession,
    event: GrowthEvent,
    operator_user_id: int,
    action: str,
    old_value: dict[str, Any] | None,
    new_value: dict[str, Any] | None,
) -> None:
    db.add(
        OperationLog(
            family_id=event.family_id,
            operator_user_id=operator_user_id,
            resource_type="growth_event",
            resource_id=event.id,
            action=action,
            source=event.source,
            old_value=old_value,
            new_value=new_value,
            created_at=now_ms(),
        )
    )


@router.get("")
async def list_events(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr | None, Query()] = None,
    event_type: Annotated[str | None, Query()] = None,
    date_from: Annotated[int | None, Query()] = None,
    date_to: Annotated[int | None, Query()] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)

    stmt: Select[tuple[GrowthEvent]] = select(GrowthEvent).where(
        GrowthEvent.family_id == family_id_int,
        GrowthEvent.status != "deleted",
    )

    if baby_id is not None:
        baby_id_int = to_db_id(baby_id)
        await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)
        stmt = stmt.where(GrowthEvent.baby_id == baby_id_int)
    if event_type is not None:
        stmt = stmt.where(GrowthEvent.event_type == event_type)
    if date_from is not None:
        stmt = stmt.where(GrowthEvent.occurred_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(GrowthEvent.occurred_at <= date_to)

    stmt = stmt.order_by(GrowthEvent.occurred_at.desc(), GrowthEvent.id.desc())
    events = await db.scalars(stmt)

    return success([_event_to_payload(item) for item in events])


@router.post("")
async def create_event(
    payload: EventCreateRequest,
    _: Annotated[str | None, Header(alias="X-Idempotency-Key")] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(payload.family_id)
    baby_id_int = to_db_id(payload.baby_id)

    await assert_family_write_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    event = GrowthEvent(
        family_id=family_id_int,
        baby_id=baby_id_int,
        event_type=payload.event_type,
        occurred_at=payload.occurred_at,
        start_at=payload.start_at,
        end_at=payload.end_at,
        timezone=payload.timezone,
        source="miniapp",
        notes=payload.notes,
        payload_snapshot=payload.payload,
        status="active",
        created_by=current_user.user_id,
        updated_by=current_user.user_id,
    )
    db.add(event)
    await db.flush()
    _enqueue_aggregate_daily(
        db=db,
        family_id=event.family_id,
        baby_id=event.baby_id,
        dates={day_start_ms(event.occurred_at)},
    )
    _add_operation_log(
        db=db,
        event=event,
        operator_user_id=current_user.user_id,
        action="create",
        old_value=None,
        new_value=_event_to_payload(event),
    )
    await db.commit()

    return success(_event_to_payload(event))


@router.get("/{event_id}")
async def get_event(
    event_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    event = await db.get(GrowthEvent, to_db_id(event_id))
    if event is None or event.status == "deleted":
        raise AppError("NOT_FOUND", "event not found", status_code=404)

    await assert_family_access(db, family_id=event.family_id, user_id=current_user.user_id)
    return success(_event_to_payload(event))


@router.patch("/{event_id}")
async def update_event(
    event_id: Annotated[IdStr, Path()],
    payload: EventUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    event = await db.get(GrowthEvent, to_db_id(event_id))
    if event is None or event.status == "deleted":
        raise AppError("NOT_FOUND", "event not found", status_code=404)

    await assert_family_write_access(db, family_id=event.family_id, user_id=current_user.user_id)
    old_payload = _event_to_payload(event)
    old_summary_date = day_start_ms(event.occurred_at)

    changes = payload.model_dump(exclude_none=True)
    if "payload" in changes:
        changes["payload_snapshot"] = changes.pop("payload")

    for key, value in changes.items():
        setattr(event, key, value)

    event.updated_by = current_user.user_id
    new_summary_date = day_start_ms(event.occurred_at)
    _enqueue_aggregate_daily(
        db=db,
        family_id=event.family_id,
        baby_id=event.baby_id,
        dates={old_summary_date, new_summary_date},
    )
    _add_operation_log(
        db=db,
        event=event,
        operator_user_id=current_user.user_id,
        action="update",
        old_value=old_payload,
        new_value=_event_to_payload(event),
    )

    await db.commit()
    return success(_event_to_payload(event))


@router.delete("/{event_id}")
async def delete_event(
    event_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    event = await db.get(GrowthEvent, to_db_id(event_id))
    if event is None or event.status == "deleted":
        raise AppError("NOT_FOUND", "event not found", status_code=404)

    await assert_family_write_access(db, family_id=event.family_id, user_id=current_user.user_id)
    old_payload = _event_to_payload(event)
    summary_date = day_start_ms(event.occurred_at)

    event.status = "deleted"
    event.deleted_at = now_ms()
    event.updated_by = current_user.user_id
    _enqueue_aggregate_daily(
        db=db,
        family_id=event.family_id,
        baby_id=event.baby_id,
        dates={summary_date},
    )
    _add_operation_log(
        db=db,
        event=event,
        operator_user_id=current_user.user_id,
        action="delete",
        old_value=old_payload,
        new_value={"id": old_payload["id"], "status": "deleted"},
    )

    await db.commit()
    return success({"id": to_api_id(event.id), "status": event.status})
