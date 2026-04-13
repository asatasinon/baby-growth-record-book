from collections import defaultdict
from typing import Any

from psycopg.types.json import Json

from app.jobs.base import TaskJob

DAY_MS = 86_400_000


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _safe_int(value: Any, default: int = 0) -> int:
    if value is None:
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _aggregate_metrics(events: list[dict[str, Any]]) -> dict[str, Any]:
    feeding_total_ml = 0
    feeding_breakdown: dict[str, int] = defaultdict(int)
    excretion_count_total = 0
    excretion_breakdown: dict[str, int] = defaultdict(int)
    sleep_total_minutes = 0
    last_measurement_snapshot: dict[str, Any] = {}

    for event in events:
        payload = event.get("payload_snapshot")
        payload = payload if isinstance(payload, dict) else {}
        event_type = str(event.get("event_type") or "")

        if event_type == "feeding":
            volume = max(_safe_int(payload.get("volume"), 0), 0)
            feeding_total_ml += volume
            feeding_breakdown[str(payload.get("mode") or "unknown")] += volume
            continue

        if event_type == "excretion":
            excretion_count_total += 1
            excretion_breakdown[str(payload.get("excretion_type") or "unknown")] += 1
            continue

        if event_type == "sleep":
            minutes = _safe_int(payload.get("duration_minutes"), 0)
            if minutes <= 0:
                start_at = event.get("start_at")
                end_at = event.get("end_at")
                if start_at and end_at and end_at > start_at:
                    minutes = (int(end_at) - int(start_at)) // 60_000
            sleep_total_minutes += max(minutes, 0)
            continue

        if event_type == "measurement":
            last_measurement_snapshot = payload

    return {
        "feeding_total_ml": feeding_total_ml,
        "feeding_breakdown": dict(feeding_breakdown),
        "excretion_count_total": excretion_count_total,
        "excretion_breakdown": dict(excretion_breakdown),
        "sleep_total_minutes": sleep_total_minutes,
        "last_measurement_snapshot": last_measurement_snapshot,
    }


def _upsert_metric(
    *,
    cursor,
    family_id: int,
    baby_id: int,
    summary_date: int,
    metric_code: str,
    metric_value: float,
    metric_unit: str,
) -> None:
    cursor.execute(
        """
        INSERT INTO metric_snapshots (
            family_id, baby_id, metric_code, bucket_type,
            bucket_date, metric_value, metric_unit, tags,
            created_at, updated_at
        ) VALUES (%s, %s, %s, 'day', %s, %s, %s, '{}'::jsonb, %s, %s)
        ON CONFLICT (baby_id, metric_code, bucket_type, bucket_date)
        DO UPDATE SET
            metric_value = EXCLUDED.metric_value,
            metric_unit = EXCLUDED.metric_unit,
            updated_at = EXCLUDED.updated_at
        """,
        (
            family_id,
            baby_id,
            metric_code,
            summary_date,
            metric_value,
            metric_unit,
            summary_date,
            summary_date,
        ),
    )


def _recalculate_day(*, cursor, family_id: int, baby_id: int, summary_date: int) -> None:
    day_end = summary_date + DAY_MS

    cursor.execute(
        """
        SELECT event_type, occurred_at, start_at, end_at, payload_snapshot
        FROM growth_events
        WHERE family_id = %s
          AND baby_id = %s
          AND status = 'active'
          AND occurred_at >= %s
          AND occurred_at < %s
        ORDER BY occurred_at ASC, id ASC
        """,
        (family_id, baby_id, summary_date, day_end),
    )
    events = cursor.fetchall()
    aggregate = _aggregate_metrics(events)

    cursor.execute(
        """
        SELECT COUNT(1) AS alert_count
        FROM alert_events
        WHERE family_id = %s
          AND baby_id = %s
          AND triggered_at >= %s
          AND triggered_at < %s
        """,
        (family_id, baby_id, summary_date, day_end),
    )
    alert_count = int(cursor.fetchone()["alert_count"] or 0)

    cursor.execute(
        """
        INSERT INTO daily_summaries (
            family_id, baby_id, summary_date,
            feeding_total_ml, feeding_breakdown,
            excretion_count_total, excretion_breakdown,
            sleep_total_minutes, last_measurement_snapshot,
            alert_count, ai_summary, created_at, updated_at
        ) VALUES (
            %s, %s, %s,
            %s, %s,
            %s, %s,
            %s, %s,
            %s, NULL, %s, %s
        )
        ON CONFLICT (family_id, baby_id, summary_date)
        DO UPDATE SET
            feeding_total_ml = EXCLUDED.feeding_total_ml,
            feeding_breakdown = EXCLUDED.feeding_breakdown,
            excretion_count_total = EXCLUDED.excretion_count_total,
            excretion_breakdown = EXCLUDED.excretion_breakdown,
            sleep_total_minutes = EXCLUDED.sleep_total_minutes,
            last_measurement_snapshot = EXCLUDED.last_measurement_snapshot,
            alert_count = EXCLUDED.alert_count,
            updated_at = EXCLUDED.updated_at
        """,
        (
            family_id,
            baby_id,
            summary_date,
            aggregate["feeding_total_ml"],
            Json(aggregate["feeding_breakdown"]),
            aggregate["excretion_count_total"],
            Json(aggregate["excretion_breakdown"]),
            aggregate["sleep_total_minutes"],
            Json(aggregate["last_measurement_snapshot"]),
            alert_count,
            summary_date,
            summary_date,
        ),
    )

    _upsert_metric(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        summary_date=summary_date,
        metric_code="feeding_total_ml",
        metric_value=float(aggregate["feeding_total_ml"]),
        metric_unit="ml",
    )
    _upsert_metric(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        summary_date=summary_date,
        metric_code="sleep_total_minutes",
        metric_value=float(aggregate["sleep_total_minutes"]),
        metric_unit="minutes",
    )
    _upsert_metric(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        summary_date=summary_date,
        metric_code="excretion_count_total",
        metric_value=float(aggregate["excretion_count_total"]),
        metric_unit="count",
    )

    last_measurement = aggregate["last_measurement_snapshot"]
    weight_value = _safe_float(last_measurement.get("weight_g"))
    if weight_value is not None:
        _upsert_metric(
            cursor=cursor,
            family_id=family_id,
            baby_id=baby_id,
            summary_date=summary_date,
            metric_code="weight_g",
            metric_value=weight_value,
            metric_unit="g",
        )

    temperature_value = _safe_float(last_measurement.get("temperature_c"))
    if temperature_value is not None:
        _upsert_metric(
            cursor=cursor,
            family_id=family_id,
            baby_id=baby_id,
            summary_date=summary_date,
            metric_code="temperature_c",
            metric_value=temperature_value,
            metric_unit="c",
        )


def handle(job: TaskJob, cursor) -> None:
    payload = job.payload
    family_id = int(payload["family_id"])
    baby_id = int(payload["baby_id"])

    date_values = payload.get("dates") or []
    if not date_values and payload.get("summary_date") is not None:
        date_values = [payload["summary_date"]]
    if not date_values and payload.get("date") is not None:
        date_values = [payload["date"]]
    if not date_values:
        raise ValueError("aggregate_daily payload missing dates")

    dates = sorted({int(item) for item in date_values})
    for summary_date in dates:
        _recalculate_day(
            cursor=cursor,
            family_id=family_id,
            baby_id=baby_id,
            summary_date=summary_date,
        )
