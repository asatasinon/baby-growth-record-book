import logging
import time
from datetime import UTC, datetime

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings
from app.jobs import aggregate_daily, ai_summary, export_report, scan_alerts
from app.jobs.base import TaskJob

logger = logging.getLogger(__name__)

HANDLERS = {
    "aggregate_daily": aggregate_daily.handle,
    "export_report": export_report.handle,
    "scan_alerts": scan_alerts.handle,
    "generate_ai_summary": ai_summary.handle,
    "ai_summary": ai_summary.handle,
}


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _fetch_and_lock_jobs(
    connection: psycopg.Connection,
    *,
    worker_id: str,
    limit: int = 10,
) -> list[TaskJob]:
    now_ms = _now_ms()
    with connection.cursor(row_factory=dict_row) as cursor:
        cursor.execute(
            """
            WITH picked AS (
                SELECT id
                FROM task_jobs
                WHERE status = 'pending'
                  AND run_after <= %s
                ORDER BY run_after ASC, id ASC
                FOR UPDATE SKIP LOCKED
                LIMIT %s
            )
            UPDATE task_jobs AS jobs
            SET status = 'running',
                locked_at = %s,
                locked_by = %s,
                updated_at = %s
            FROM picked
            WHERE jobs.id = picked.id
            RETURNING jobs.id, jobs.job_type, jobs.payload, jobs.retry_count, jobs.max_retries
            """,
            (now_ms, limit, now_ms, worker_id, now_ms),
        )
        rows = cursor.fetchall()
    connection.commit()
    return [
        TaskJob(
            id=int(row["id"]),
            job_type=str(row["job_type"]),
            payload=row["payload"] if isinstance(row["payload"], dict) else {},
            retry_count=int(row["retry_count"] or 0),
            max_retries=int(row["max_retries"] or 3),
        )
        for row in rows
    ]


def _mark_job_succeeded(connection: psycopg.Connection, job_id: int) -> None:
    now_ms = _now_ms()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE task_jobs
            SET status = 'succeeded',
                error_message = NULL,
                updated_at = %s
            WHERE id = %s
            """,
            (now_ms, job_id),
        )
    connection.commit()


def _mark_job_failed(connection: psycopg.Connection, job: TaskJob, message: str) -> None:
    now_ms = _now_ms()
    next_retry_count = job.retry_count + 1
    should_retry = next_retry_count <= job.max_retries
    run_after = now_ms + min(300_000, 15_000 * next_retry_count)

    with connection.cursor() as cursor:
        if should_retry:
            cursor.execute(
                """
                UPDATE task_jobs
                SET status = 'pending',
                    retry_count = %s,
                    run_after = %s,
                    error_message = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (next_retry_count, run_after, message[:1000], now_ms, job.id),
            )
        else:
            cursor.execute(
                """
                UPDATE task_jobs
                SET status = 'failed',
                    retry_count = %s,
                    error_message = %s,
                    updated_at = %s
                WHERE id = %s
                """,
                (next_retry_count, message[:1000], now_ms, job.id),
            )
    connection.commit()


def run_forever() -> None:
    settings = get_settings()
    logger.info(
        "worker.started",
        extra={"app_env": settings.app_env, "worker_id": settings.worker_id},
    )

    while True:
        try:
            with psycopg.connect(settings.db_dsn, autocommit=False) as connection:
                jobs = _fetch_and_lock_jobs(connection, worker_id=settings.worker_id, limit=20)
                if not jobs:
                    time.sleep(settings.poll_interval_seconds)
                    continue

                for job in jobs:
                    handler = HANDLERS.get(job.job_type)
                    if not handler:
                        _mark_job_failed(connection, job, f"unsupported job type: {job.job_type}")
                        continue

                    try:
                        logger.info(
                            "worker.job.start",
                            extra={"job_id": job.id, "job_type": job.job_type},
                        )
                        with connection.cursor(row_factory=dict_row) as cursor:
                            handler(job, cursor)
                        connection.commit()
                        _mark_job_succeeded(connection, job.id)
                        logger.info(
                            "worker.job.done",
                            extra={"job_id": job.id, "job_type": job.job_type},
                        )
                    except Exception as exc:
                        connection.rollback()
                        _mark_job_failed(connection, job, str(exc))
                        logger.exception(
                            "worker.job.failed",
                            extra={"job_id": job.id, "job_type": job.job_type},
                        )
        except Exception:
            logger.exception("worker.loop.error")
            time.sleep(settings.poll_interval_seconds)
