from __future__ import annotations

from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.time_utils import DAY_MS, now_ms
from app.models.alert import AlertEvent
from app.models.baby import Baby
from app.models.event import GrowthEvent
from app.models.summary import DailySummary

_DISCLAIMER = "结果仅基于记录数据生成，不替代医生建议。"


async def build_ai_context(
    db: AsyncSession,
    *,
    family_id: int,
    baby_id: int,
    window_days: int,
) -> dict[str, Any]:
    baby = await db.get(Baby, baby_id)
    if baby is None or baby.family_id != family_id:
        raise AppError("NOT_FOUND", "baby not found", status_code=404)

    window_end = now_ms()
    window_start = window_end - window_days * DAY_MS

    events = await db.scalars(
        select(GrowthEvent)
        .where(
            GrowthEvent.family_id == family_id,
            GrowthEvent.baby_id == baby_id,
            GrowthEvent.status == "active",
            GrowthEvent.occurred_at >= window_start,
            GrowthEvent.occurred_at <= window_end,
        )
        .order_by(GrowthEvent.occurred_at.asc(), GrowthEvent.id.asc())
    )
    event_rows = list(events)

    summaries = await db.scalars(
        select(DailySummary)
        .where(
            DailySummary.family_id == family_id,
            DailySummary.baby_id == baby_id,
            DailySummary.summary_date >= window_start,
            DailySummary.summary_date <= window_end,
        )
        .order_by(DailySummary.summary_date.desc())
        .limit(30)
    )
    summary_rows = list(summaries)

    alerts = await db.scalars(
        select(AlertEvent)
        .where(
            AlertEvent.family_id == family_id,
            AlertEvent.baby_id == baby_id,
            AlertEvent.triggered_at >= window_start,
            AlertEvent.triggered_at <= window_end,
        )
        .order_by(AlertEvent.triggered_at.desc())
        .limit(10)
    )
    alert_rows = list(alerts)

    event_counter: dict[str, int] = {}
    for evt in event_rows:
        event_counter[evt.event_type] = event_counter.get(evt.event_type, 0) + 1

    return {
        "window": {"start": window_start, "end": window_end, "days": window_days},
        "baby_profile": {
            "id": baby.id,
            "name": baby.name,
            "nickname": baby.nickname,
            "gender": baby.gender,
            "birth_date": baby.birth_date,
        },
        "event_counter": event_counter,
        "daily_summaries": [
            {
                "summary_date": item.summary_date,
                "feeding_total_ml": item.feeding_total_ml,
                "excretion_count_total": item.excretion_count_total,
                "sleep_total_minutes": item.sleep_total_minutes,
                "last_measurement_snapshot": item.last_measurement_snapshot,
                "alert_count": item.alert_count,
            }
            for item in summary_rows
        ],
        "recent_alerts": [
            {
                "severity": item.severity,
                "title": item.title,
                "triggered_at": item.triggered_at,
                "status": item.status,
            }
            for item in alert_rows
        ],
    }


def build_query_messages(question: str, context: dict[str, Any]) -> list[dict[str, str]]:
    system_prompt = (
        "你是婴儿成长记录助手。你必须只使用提供的结构化上下文回答，不得编造数据。"
        "必须说明时间窗口；无法确认的数据要明确标注“无法确认”。"
        f"回答结尾必须附加免责声明：{_DISCLAIMER}"
    )
    user_prompt = (
        f"用户问题：{question}\n"
        f"上下文：{context}\n"
        "请给出简洁结论、关键依据和可执行建议。"
    )
    return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]


def build_summary_messages(summary_type: str, context: dict[str, Any]) -> list[dict[str, str]]:
    system_prompt = (
        "你是婴儿成长记录助手。请基于输入上下文生成结构化摘要，不得虚构。"
        "输出三段：概览、异常与风险、建议。"
        f"结尾必须附加免责声明：{_DISCLAIMER}"
    )
    user_prompt = (
        f"请生成 {summary_type} 摘要。\n"
        f"上下文：{context}\n"
        "请明确说明时间窗口。"
    )
    return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]


async def call_llm(messages: list[dict[str, str]]) -> tuple[str, int | None]:
    settings = get_settings()
    if not settings.llm_base_url or not settings.llm_api_key:
        raise AppError(
            "AI_SERVICE_UNAVAILABLE",
            "llm config missing",
            data={"required": ["LLM_BASE_URL", "LLM_API_KEY"]},
            status_code=503,
        )

    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.llm_model or "gpt-4o-mini",
        "messages": messages,
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, json=body, headers=headers)
    except httpx.HTTPError as exc:
        raise AppError("AI_SERVICE_UNAVAILABLE", "llm request failed", status_code=503) from exc

    if response.status_code >= 400:
        raise AppError(
            "AI_SERVICE_UNAVAILABLE",
            "llm service returned error",
            data={"status_code": response.status_code},
            status_code=503,
        )

    payload = response.json()
    try:
        answer = str(payload["choices"][0]["message"]["content"]).strip()
    except Exception as exc:
        raise AppError("AI_SERVICE_UNAVAILABLE", "invalid llm response", status_code=503) from exc

    usage = payload.get("usage") or {}
    total_tokens = usage.get("total_tokens")
    return answer, int(total_tokens) if isinstance(total_tokens, int) else None


def disclaimer_text() -> str:
    return _DISCLAIMER
