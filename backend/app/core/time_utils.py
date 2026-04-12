from datetime import UTC, datetime, timedelta

DAY_MS = 86_400_000


def now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def day_start_ms(timestamp_ms: int) -> int:
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC)
    day = datetime(dt.year, dt.month, dt.day, tzinfo=UTC)
    return int(day.timestamp() * 1000)


def week_start_ms(timestamp_ms: int) -> int:
    day_start = day_start_ms(timestamp_ms)
    day = datetime.fromtimestamp(day_start / 1000, tz=UTC)
    monday = day - timedelta(days=day.weekday())
    return int(monday.timestamp() * 1000)


def month_start_ms(timestamp_ms: int) -> int:
    dt = datetime.fromtimestamp(timestamp_ms / 1000, tz=UTC)
    month = datetime(dt.year, dt.month, 1, tzinfo=UTC)
    return int(month.timestamp() * 1000)


def next_day_start_ms(timestamp_ms: int) -> int:
    return day_start_ms(timestamp_ms) + DAY_MS


def next_week_start_ms(timestamp_ms: int) -> int:
    return week_start_ms(timestamp_ms) + DAY_MS * 7


def next_month_start_ms(timestamp_ms: int) -> int:
    dt = datetime.fromtimestamp(month_start_ms(timestamp_ms) / 1000, tz=UTC)
    if dt.month == 12:
        next_month = datetime(dt.year + 1, 1, 1, tzinfo=UTC)
    else:
        next_month = datetime(dt.year, dt.month + 1, 1, tzinfo=UTC)
    return int(next_month.timestamp() * 1000)


def bucket_start_ms(timestamp_ms: int, bucket: str) -> int:
    if bucket == "day":
        return day_start_ms(timestamp_ms)
    if bucket == "week":
        return week_start_ms(timestamp_ms)
    if bucket == "month":
        return month_start_ms(timestamp_ms)
    raise ValueError(f"unsupported bucket: {bucket}")
