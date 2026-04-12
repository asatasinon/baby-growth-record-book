from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.permissions import assert_baby_belongs_family, assert_family_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import DAY_MS, next_month_start_ms
from app.models.alert import AlertEvent
from app.models.event import GrowthEvent
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/summaries", tags=["summaries"])


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


async def _load_events(
    db: AsyncSession,
    *,
    family_id: int,
    baby_id: int,
    start_ms: int,
    end_ms: int,
) -> list[GrowthEvent]:
    stmt = (
        select(GrowthEvent)
        .where(
            GrowthEvent.family_id == family_id,
            GrowthEvent.baby_id == baby_id,
            GrowthEvent.status == "active",
            GrowthEvent.occurred_at >= start_ms,
            GrowthEvent.occurred_at < end_ms,
        )
        .order_by(GrowthEvent.occurred_at.asc(), GrowthEvent.id.asc())
    )
    rows = await db.scalars(stmt)
    return list(rows)


def _aggregate_events(events: list[GrowthEvent]) -> dict[str, Any]:
    feeding_total_ml = 0
    feeding_breakdown: dict[str, int] = defaultdict(int)
    excretion_count_total = 0
    excretion_breakdown: dict[str, int] = defaultdict(int)
    sleep_total_minutes = 0
    last_measurement_snapshot: dict[str, Any] = {}

    measurement_events = [evt for evt in events if evt.event_type == "measurement"]
    if measurement_events:
        latest = measurement_events[-1]
        if isinstance(latest.payload_snapshot, dict):
            last_measurement_snapshot = latest.payload_snapshot

    for evt in events:
        payload = evt.payload_snapshot if isinstance(evt.payload_snapshot, dict) else {}

        if evt.event_type == "feeding":
            volume = _to_int(payload.get("volume"), default=0)
            feeding_total_ml += max(volume, 0)
            mode = str(payload.get("mode") or "unknown")
            feeding_breakdown[mode] += max(volume, 0)

        if evt.event_type == "excretion":
            excretion_count_total += 1
            ex_type = str(payload.get("excretion_type") or "unknown")
            excretion_breakdown[ex_type] += 1

        if evt.event_type == "sleep":
            duration = _to_int(payload.get("duration_minutes"), default=0)
            if duration <= 0 and evt.start_at is not None and evt.end_at is not None:
                duration = max((evt.end_at - evt.start_at) // 60000, 0)
            sleep_total_minutes += duration

    return {
        "feeding_total_ml": feeding_total_ml,
        "feeding_breakdown": dict(feeding_breakdown),
        "excretion_count_total": excretion_count_total,
        "excretion_breakdown": dict(excretion_breakdown),
        "sleep_total_minutes": sleep_total_minutes,
        "last_measurement_snapshot": last_measurement_snapshot,
    }


async def _load_alerts(
    db: AsyncSession,
    *,
    family_id: int,
    baby_id: int,
    start_ms: int,
    end_ms: int,
) -> list[dict[str, Any]]:
    stmt = (
        select(AlertEvent)
        .where(
            AlertEvent.family_id == family_id,
            AlertEvent.baby_id == baby_id,
            AlertEvent.triggered_at >= start_ms,
            AlertEvent.triggered_at < end_ms,
        )
        .order_by(AlertEvent.triggered_at.desc(), AlertEvent.id.desc())
    )
    alerts = await db.scalars(stmt)

    return [
        {
            "id": to_api_id(item.id),
            "severity": item.severity,
            "title": item.title,
            "status": item.status,
            "triggered_at": item.triggered_at,
        }
        for item in alerts
    ]


@router.get("/daily")
async def get_daily_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    date: Annotated[int, Query()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    baby_id_int = to_db_id(baby_id)

    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    day_start = date
    day_end = day_start + DAY_MS
    events = await _load_events(
        db,
        family_id=family_id_int,
        baby_id=baby_id_int,
        start_ms=day_start,
        end_ms=day_end,
    )
    aggregate = _aggregate_events(events)
    alerts = await _load_alerts(
        db,
        family_id=family_id_int,
        baby_id=baby_id_int,
        start_ms=day_start,
        end_ms=day_end,
    )

    return success(
        {
            "summary_date": date,
            "feeding_total_ml": aggregate["feeding_total_ml"],
            "feeding_breakdown": aggregate["feeding_breakdown"],
            "excretion_count_total": aggregate["excretion_count_total"],
            "excretion_breakdown": aggregate["excretion_breakdown"],
            "sleep_total_minutes": aggregate["sleep_total_minutes"],
            "last_measurement_snapshot": aggregate["last_measurement_snapshot"],
            "alerts": alerts,
        }
    )


@router.get("/weekly")
async def get_weekly_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    week_start: Annotated[int, Query()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    baby_id_int = to_db_id(baby_id)

    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    week_end = week_start + DAY_MS * 7
    events = await _load_events(
        db,
        family_id=family_id_int,
        baby_id=baby_id_int,
        start_ms=week_start,
        end_ms=week_end,
    )
    aggregate = _aggregate_events(events)

    return success(
        {
            "family_id": to_api_id(family_id_int),
            "baby_id": to_api_id(baby_id_int),
            "week_start": week_start,
            "summary_payload": aggregate,
        }
    )


@router.get("/monthly")
async def get_monthly_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    month: Annotated[int, Query()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    baby_id_int = to_db_id(baby_id)

    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    month_end = next_month_start_ms(month)
    events = await _load_events(
        db,
        family_id=family_id_int,
        baby_id=baby_id_int,
        start_ms=month,
        end_ms=month_end,
    )
    aggregate = _aggregate_events(events)

    return success(
        {
            "family_id": to_api_id(family_id_int),
            "baby_id": to_api_id(baby_id_int),
            "month": month,
            "summary_payload": aggregate,
        }
    )
