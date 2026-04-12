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
from app.core.time_utils import now_ms
from app.models.event import GrowthEvent
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

    changes = payload.model_dump(exclude_none=True)
    if "payload" in changes:
        changes["payload_snapshot"] = changes.pop("payload")

    for key, value in changes.items():
        setattr(event, key, value)

    event.updated_by = current_user.user_id

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

    event.status = "deleted"
    event.deleted_at = now_ms()
    event.updated_by = current_user.user_id

    await db.commit()
    return success({"id": to_api_id(event.id), "status": event.status})
