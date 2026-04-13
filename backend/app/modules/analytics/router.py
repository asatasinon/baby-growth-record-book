from collections import defaultdict
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import assert_baby_belongs_family, assert_family_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import bucket_start_ms
from app.models.event import GrowthEvent
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/analytics", tags=["analytics"])


_SUM_METRICS = {"feeding_total_ml", "sleep_total_minutes", "excretion_count_total"}
_LAST_METRICS = {"weight_g", "temperature_c"}
_SUPPORTED_METRICS = _SUM_METRICS | _LAST_METRICS
_METRIC_UNITS = {
    "feeding_total_ml": "ml",
    "sleep_total_minutes": "minutes",
    "excretion_count_total": "count",
    "weight_g": "g",
    "temperature_c": "c",
}


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _event_metric_value(event: GrowthEvent, metric_code: str) -> float | None:
    payload = event.payload_snapshot if isinstance(event.payload_snapshot, dict) else {}

    if metric_code == "feeding_total_ml":
        if event.event_type != "feeding":
            return None
        return _to_float(payload.get("volume")) or 0.0

    if metric_code == "sleep_total_minutes":
        if event.event_type != "sleep":
            return None
        value = _to_float(payload.get("duration_minutes"))
        if value is not None:
            return max(value, 0.0)
        if (
            event.start_at is not None
            and event.end_at is not None
            and event.end_at > event.start_at
        ):
            return max((event.end_at - event.start_at) / 60000, 0.0)
        return 0.0

    if metric_code == "excretion_count_total":
        if event.event_type != "excretion":
            return None
        return 1.0

    if metric_code == "weight_g":
        if event.event_type != "measurement":
            return None
        return _to_float(payload.get("weight_g"))

    if metric_code == "temperature_c":
        if event.event_type != "measurement":
            return None
        return _to_float(payload.get("temperature_c"))

    return None


@router.get("/trends")
async def get_trends(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    metric_code: Annotated[str, Query()],
    date_from: Annotated[int, Query()],
    date_to: Annotated[int, Query()],
    bucket: Annotated[str, Query()] = "minute",
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    baby_id_int = to_db_id(baby_id)

    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id_int, family_id=family_id_int)

    if metric_code not in _SUPPORTED_METRICS:
        raise AppError(
            "INVALID_ARGUMENT",
            "unsupported metric_code",
            {"field": "metric_code", "value": metric_code},
            status_code=400,
        )

    if bucket not in {"minute", "day", "week", "month"}:
        raise AppError(
            "INVALID_ARGUMENT",
            "unsupported bucket",
            {"field": "bucket", "value": bucket},
            status_code=400,
        )

    if date_to < date_from:
        raise AppError(
            "INVALID_ARGUMENT",
            "date_to must be greater than date_from",
            {"field": "date_to", "value": date_to},
            status_code=400,
        )

    events = await db.scalars(
        select(GrowthEvent)
        .where(
            GrowthEvent.family_id == family_id_int,
            GrowthEvent.baby_id == baby_id_int,
            GrowthEvent.status == "active",
            GrowthEvent.occurred_at >= date_from,
            GrowthEvent.occurred_at <= date_to,
        )
        .order_by(GrowthEvent.occurred_at.asc(), GrowthEvent.id.asc())
    )

    if metric_code in _SUM_METRICS:
        bucket_values: dict[int, float] = defaultdict(float)
        for event in events:
            value = _event_metric_value(event, metric_code)
            if value is None:
                continue
            bucket_ts = bucket_start_ms(event.occurred_at, bucket)
            bucket_values[bucket_ts] += value
        points = [
            {"bucket_date": date_key, "value": round(value, 2)}
            for date_key, value in sorted(bucket_values.items(), key=lambda item: item[0])
        ]
    else:
        bucket_latest: dict[int, tuple[int, float]] = {}
        for event in events:
            value = _event_metric_value(event, metric_code)
            if value is None:
                continue
            bucket_ts = bucket_start_ms(event.occurred_at, bucket)
            last_event = bucket_latest.get(bucket_ts)
            if last_event is None or event.occurred_at >= last_event[0]:
                bucket_latest[bucket_ts] = (event.occurred_at, value)

        points = [
            {"bucket_date": date_key, "value": round(value[1], 2)}
            for date_key, value in sorted(bucket_latest.items(), key=lambda item: item[0])
        ]

    return success(
        {
            "family_id": to_api_id(family_id_int),
            "baby_id": to_api_id(baby_id_int),
            "metric_code": metric_code,
            "unit": _METRIC_UNITS.get(metric_code, ""),
            "bucket": bucket,
            "window": {"date_from": date_from, "date_to": date_to},
            "points": points,
        }
    )
