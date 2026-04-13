import json
from datetime import UTC, datetime

from app.core.storage import upload_object
from app.jobs.base import TaskJob


def _format_report_content(task: dict, summaries: list[dict]) -> bytes:
    payload = {
        "generated_at": int(datetime.now(UTC).timestamp() * 1000),
        "task": {
            "id": task["id"],
            "family_id": task["family_id"],
            "baby_id": task["baby_id"],
            "report_type": task["report_type"],
            "date_from": task["date_from"],
            "date_to": task["date_to"],
        },
        "summaries": summaries,
    }
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


def handle(job: TaskJob, cursor) -> None:
    task_id = job.payload.get("task_id")
    if task_id is None:
        raise ValueError("export_report payload missing task_id")
    task_id = int(task_id)

    now_ms = int(datetime.now(UTC).timestamp() * 1000)
    cursor.execute(
        """
        SELECT id, family_id, baby_id, report_type, date_from, date_to, status
        FROM export_tasks
        WHERE id = %s
        FOR UPDATE
        """,
        (task_id,),
    )
    task = cursor.fetchone()
    if task is None:
        raise ValueError(f"export task not found: {task_id}")

    try:
        cursor.execute(
            """
            UPDATE export_tasks
            SET status = 'running', updated_at = %s, error_message = NULL
            WHERE id = %s
            """,
            (now_ms, task_id),
        )

        cursor.execute(
            """
            SELECT
                summary_date,
                feeding_total_ml,
                excretion_count_total,
                sleep_total_minutes,
                alert_count
            FROM daily_summaries
            WHERE family_id = %s
              AND baby_id = %s
              AND summary_date >= %s
              AND summary_date <= %s
            ORDER BY summary_date ASC
            """,
            (task["family_id"], task["baby_id"], task["date_from"], task["date_to"]),
        )
        summaries = cursor.fetchall()

        report_bytes = _format_report_content(task, summaries)
        object_key = f"reports/{task['family_id']}/{task['baby_id']}/{task_id}.json"
        download_url = upload_object(object_key, report_bytes, content_type="application/json")

        expires_at = now_ms + 86_400_000
        cursor.execute(
            """
            UPDATE export_tasks
            SET status = 'succeeded',
                object_key = %s,
                download_url = %s,
                expires_at = %s,
                error_message = NULL,
                updated_at = %s
            WHERE id = %s
            """,
            (object_key, download_url, expires_at, now_ms, task_id),
        )
    except Exception as exc:
        cursor.execute(
            """
            UPDATE export_tasks
            SET status = 'failed',
                error_message = %s,
                updated_at = %s
            WHERE id = %s
            """,
            (str(exc)[:1000], now_ms, task_id),
        )
        raise
