from datetime import UTC, datetime
from typing import Any

from app.jobs.base import TaskJob

DAY_MS = 86_400_000


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _day_start_ms(timestamp_ms: int) -> int:
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC)
    day = datetime(dt.year, dt.month, dt.day, tzinfo=UTC)
    return int(day.timestamp() * 1000)


def _insert_alert_if_missing(
    *,
    cursor,
    family_id: int,
    baby_id: int,
    rule_id: int,
    severity: str,
    title: str,
    content: str,
    now_ms: int,
) -> None:
    day_start = _day_start_ms(now_ms)
    cursor.execute(
        """
        SELECT id
        FROM alert_events
        WHERE family_id = %s
          AND baby_id = %s
          AND rule_id = %s
          AND title = %s
          AND triggered_at >= %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (family_id, baby_id, rule_id, title, day_start),
    )
    if cursor.fetchone() is not None:
        return

    cursor.execute(
        """
        INSERT INTO alert_events (
            family_id, baby_id, rule_id, severity, title,
            content, status, triggered_at, created_at, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, 'open', %s, %s, %s)
        """,
        (family_id, baby_id, rule_id, severity, title, content, now_ms, now_ms, now_ms),
    )


def _handle_feeding_interval_rule(
    *,
    cursor,
    rule: dict[str, Any],
    family_id: int,
    baby_id: int,
) -> None:
    now_ms = _now_ms()
    window_hours = int(rule["window_hours"] or 4)
    threshold_ms = window_hours * 3_600_000

    cursor.execute(
        """
        SELECT occurred_at
        FROM growth_events
        WHERE family_id = %s
          AND baby_id = %s
          AND event_type = 'feeding'
          AND status = 'active'
        ORDER BY occurred_at DESC
        LIMIT 1
        """,
        (family_id, baby_id),
    )
    row = cursor.fetchone()
    if row is None:
        return

    if now_ms - int(row["occurred_at"]) <= threshold_ms:
        return

    _insert_alert_if_missing(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        rule_id=rule["id"],
        severity=rule["severity"],
        title="喂养间隔过长",
        content=f"最近一次喂养已超过 {window_hours} 小时，请关注宝宝进食情况。",
        now_ms=now_ms,
    )


def _handle_temperature_rule(*, cursor, rule: dict[str, Any], family_id: int, baby_id: int) -> None:
    threshold = float(rule["threshold_value"] or 37.5)
    now_ms = _now_ms()
    cursor.execute(
        """
        SELECT payload_snapshot
        FROM growth_events
        WHERE family_id = %s
          AND baby_id = %s
          AND event_type = 'measurement'
          AND status = 'active'
        ORDER BY occurred_at DESC
        LIMIT 1
        """,
        (family_id, baby_id),
    )
    row = cursor.fetchone()
    if row is None:
        return

    payload = row["payload_snapshot"] if isinstance(row["payload_snapshot"], dict) else {}
    temperature = payload.get("temperature_c")
    if temperature is None or float(temperature) < threshold:
        return

    _insert_alert_if_missing(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        rule_id=rule["id"],
        severity=rule["severity"],
        title="体温异常提醒",
        content=f"最新体温 {temperature}℃，超过阈值 {threshold}℃。",
        now_ms=now_ms,
    )


def _handle_low_excretion_rule(
    *,
    cursor,
    rule: dict[str, Any],
    family_id: int,
    baby_id: int,
) -> None:
    now_ms = _now_ms()
    window_days = int(rule["window_days"] or 1)
    minimum_count = int(float(rule["threshold_value"] or 2))
    window_start = now_ms - window_days * DAY_MS

    cursor.execute(
        """
        SELECT COUNT(1) AS cnt
        FROM growth_events
        WHERE family_id = %s
          AND baby_id = %s
          AND event_type = 'excretion'
          AND status = 'active'
          AND occurred_at >= %s
        """,
        (family_id, baby_id, window_start),
    )
    row = cursor.fetchone()
    actual_count = int(row["cnt"] or 0)
    if actual_count >= minimum_count:
        return

    _insert_alert_if_missing(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        rule_id=rule["id"],
        severity=rule["severity"],
        title="排泄次数偏少",
        content=f"过去 {window_days} 天排泄 {actual_count} 次，低于阈值 {minimum_count} 次。",
        now_ms=now_ms,
    )


def handle(job: TaskJob, cursor) -> None:
    payload = job.payload
    if "family_id" not in payload:
        raise ValueError("scan_alerts payload missing family_id")

    family_id = int(payload["family_id"])
    target_baby_id = int(payload["baby_id"]) if payload.get("baby_id") is not None else None

    cursor.execute(
        """
        SELECT id, rule_type, threshold_value, window_hours, window_days, severity
        FROM alert_rules
        WHERE family_id = %s
          AND enabled = TRUE
        """,
        (family_id,),
    )
    rules = cursor.fetchall()
    if not rules:
        return

    if target_baby_id is None:
        cursor.execute(
            """
            SELECT id
            FROM babies
            WHERE family_id = %s
              AND status = 'active'
            """,
            (family_id,),
        )
        baby_ids = [int(item["id"]) for item in cursor.fetchall()]
    else:
        baby_ids = [target_baby_id]

    for baby_id in baby_ids:
        for rule in rules:
            rule_type = str(rule["rule_type"])
            if rule_type == "feeding_interval_too_long":
                _handle_feeding_interval_rule(
                    cursor=cursor,
                    rule=rule,
                    family_id=family_id,
                    baby_id=baby_id,
                )
            elif rule_type == "abnormal_temperature":
                _handle_temperature_rule(
                    cursor=cursor,
                    rule=rule,
                    family_id=family_id,
                    baby_id=baby_id,
                )
            elif rule_type == "low_excretion_count_rolling":
                _handle_low_excretion_rule(
                    cursor=cursor,
                    rule=rule,
                    family_id=family_id,
                    baby_id=baby_id,
                )
