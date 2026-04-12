from typing import Annotated, Any

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/events", tags=["events"])


class EventCreateRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    event_type: str
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


@router.get("")
def list_events(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr | None, Query()] = None,
    event_type: Annotated[str | None, Query()] = None,
    date_from: Annotated[int | None, Query()] = None,
    date_to: Annotated[int | None, Query()] = None,
) -> dict:
    return success(
        [
            {
                "id": "40001",
                "family_id": family_id,
                "baby_id": baby_id or "30001",
                "event_type": event_type or "feeding",
                "occurred_at": date_from or 1744416720000,
                "date_to": date_to,
                "status": "active",
            }
        ]
    )


@router.post("")
def create_event(payload: EventCreateRequest) -> dict:
    return success({"id": "40002", "status": "active", **payload.model_dump()})


@router.get("/{event_id}")
def get_event(event_id: Annotated[IdStr, Path()]) -> dict:
    return success(
        {
            "id": event_id,
            "family_id": "20001",
            "baby_id": "30001",
            "event_type": "feeding",
            "occurred_at": 1744416720000,
            "payload": {"mode": "formula", "volume": 90, "unit": "ml"},
            "status": "active",
        }
    )


@router.patch("/{event_id}")
def update_event(event_id: Annotated[IdStr, Path()], payload: EventUpdateRequest) -> dict:
    return success({"id": event_id, **payload.model_dump(exclude_none=True)})


@router.delete("/{event_id}")
def delete_event(event_id: Annotated[IdStr, Path()]) -> dict:
    return success({"id": event_id, "status": "deleted"})
