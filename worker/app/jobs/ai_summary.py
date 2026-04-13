from datetime import UTC, datetime
from typing import Any

from app.core.llm import generate_text
from app.jobs.base import TaskJob


def _now_ms() -> int:
    return int(datetime.now(UTC).timestamp() * 1000)


def _build_prompt(summary_type: str, payload: dict[str, Any]) -> str:
    return (
        f"请基于以下数据生成{summary_type}摘要，分三段：概览、异常与风险、建议。\n"
        f"数据：{payload}\n"
        "必须说明时间窗口，并附加免责声明：结果仅基于记录数据生成，不替代医生建议。"
    )


def _load_daily_payload(
    *,
    cursor,
    family_id: int,
    baby_id: int,
    summary_date: int,
) -> dict[str, Any]:
    cursor.execute(
        """
        SELECT
            summary_date,
            feeding_total_ml,
            excretion_count_total,
            sleep_total_minutes,
            last_measurement_snapshot
        FROM daily_summaries
        WHERE family_id = %s
          AND baby_id = %s
          AND summary_date = %s
        LIMIT 1
        """,
        (family_id, baby_id, summary_date),
    )
    row = cursor.fetchone()
    if row is None:
        raise ValueError("daily summary not found for ai_summary")
    return dict(row)


def handle(job: TaskJob, cursor) -> None:
    family_id = int(job.payload["family_id"])
    baby_id = int(job.payload["baby_id"])
    summary_type = str(job.payload.get("summary_type") or "daily")
    summary_date = int(job.payload.get("summary_date") or _now_ms())

    source_payload = _load_daily_payload(
        cursor=cursor,
        family_id=family_id,
        baby_id=baby_id,
        summary_date=summary_date,
    )

    prompt = _build_prompt(summary_type, source_payload)
    ai_text, total_tokens = generate_text(prompt)
    now_ms = _now_ms()

    cursor.execute(
        """
        UPDATE daily_summaries
        SET ai_summary = %s, updated_at = %s
        WHERE family_id = %s
          AND baby_id = %s
          AND summary_date = %s
        """,
        (ai_text, now_ms, family_id, baby_id, summary_date),
    )

    cursor.execute(
        """
        INSERT INTO ai_conversations (
            family_id, baby_id, asked_by, question, answer, model_name, context_window,
            status, error_message, created_at
        ) VALUES (%s, %s, NULL, %s, %s, %s, %s, 'succeeded', NULL, %s)
        RETURNING id
        """,
        (
            family_id,
            baby_id,
            f"generate_{summary_type}_summary",
            ai_text,
            "openai-compatible",
            str(summary_date),
            now_ms,
        ),
    )
    conversation_id = int(cursor.fetchone()["id"])

    cursor.execute(
        """
        INSERT INTO ai_messages (conversation_id, role, content, token_count, created_at)
        VALUES (%s, 'user', %s, NULL, %s)
        """,
        (conversation_id, prompt, now_ms),
    )
    cursor.execute(
        """
        INSERT INTO ai_messages (conversation_id, role, content, token_count, created_at)
        VALUES (%s, 'assistant', %s, %s, %s)
        """,
        (conversation_id, ai_text, total_tokens, now_ms),
    )
