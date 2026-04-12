from collections import Counter

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.permissions import assert_baby_belongs_family, assert_family_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import DAY_MS, now_ms
from app.models.ai import AiConversation, AiMessage
from app.models.event import GrowthEvent
from app.schemas.id_types import IdStr, to_db_id

router = APIRouter(prefix="/ai", tags=["ai"])


class AiQueryRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    question: str


def _build_answer(question: str, event_counter: Counter[str], total_count: int) -> str:
    if total_count == 0:
        return (
            f"你问的是：{question}。在当前查询时间窗口内暂未找到可用记录，"
            "建议先补充喂养、睡眠、排泄或测量数据后再提问。"
        )

    key_parts = []
    for event_type in ["feeding", "sleep", "excretion", "measurement"]:
        if event_counter[event_type] > 0:
            key_parts.append(f"{event_type}:{event_counter[event_type]}条")

    summary_text = "，".join(key_parts) if key_parts else f"共{total_count}条记录"
    return (
        f"你问的是：{question}。在当前时间窗口内共检索到{total_count}条记录（{summary_text}），"
        "建议结合趋势和日报页面进一步查看明细。"
    )


@router.post("/query")
async def query_ai(
    payload: AiQueryRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id = to_db_id(payload.family_id)
    baby_id = to_db_id(payload.baby_id)

    await assert_family_access(db, family_id=family_id, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id, family_id=family_id)

    window_end = now_ms()
    window_start = window_end - DAY_MS * 7

    events = await db.scalars(
        select(GrowthEvent.event_type)
        .where(
            GrowthEvent.family_id == family_id,
            GrowthEvent.baby_id == baby_id,
            GrowthEvent.status == "active",
            GrowthEvent.occurred_at >= window_start,
            GrowthEvent.occurred_at <= window_end,
        )
        .order_by(GrowthEvent.occurred_at.asc())
    )

    event_counter = Counter(events)
    total_count = sum(event_counter.values())
    answer = _build_answer(payload.question, event_counter, total_count)

    created_at = now_ms()
    conversation = AiConversation(
        family_id=family_id,
        baby_id=baby_id,
        asked_by=current_user.user_id,
        question=payload.question,
        answer=answer,
        model_name="rule-based-v1",
        context_window=f"{window_start}-{window_end}",
        status="succeeded",
        error_message=None,
        created_at=created_at,
    )
    db.add(conversation)
    await db.flush()

    db.add(
        AiMessage(
            conversation_id=conversation.id,
            role="user",
            content=payload.question,
            token_count=None,
            created_at=created_at,
        )
    )
    db.add(
        AiMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=answer,
            token_count=None,
            created_at=now_ms(),
        )
    )

    await db.commit()

    return success(
        {
            "answer": answer,
            "window_start": window_start,
            "window_end": window_end,
            "disclaimer": "结果基于记录数据生成，不替代医生建议。",
        }
    )
