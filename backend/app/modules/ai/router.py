from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.permissions import assert_baby_belongs_family, assert_family_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import now_ms
from app.models.ai import AiConversation, AiMessage
from app.modules.ai.service import (
    build_ai_context,
    build_query_messages,
    build_summary_messages,
    call_llm,
    disclaimer_text,
)
from app.schemas.id_types import IdStr, to_db_id

router = APIRouter(prefix="/ai", tags=["ai"])


class AiQueryRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    question: str


class AiSummaryRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    summary_type: str
    summary_date: int | None = None


async def _persist_conversation(
    *,
    db: AsyncSession,
    family_id: int,
    baby_id: int,
    asked_by: int,
    question: str,
    answer: str | None,
    context_window: str,
    status: str,
    model_name: str,
    user_tokens: int | None,
    assistant_tokens: int | None,
    error_message: str | None = None,
) -> None:
    created_at = now_ms()
    conversation = AiConversation(
        family_id=family_id,
        baby_id=baby_id,
        asked_by=asked_by,
        question=question,
        answer=answer,
        model_name=model_name,
        context_window=context_window,
        status=status,
        error_message=error_message,
        created_at=created_at,
    )
    db.add(conversation)
    await db.flush()

    db.add(
        AiMessage(
            conversation_id=conversation.id,
            role="user",
            content=question,
            token_count=user_tokens,
            created_at=created_at,
        )
    )
    if answer:
        db.add(
            AiMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=answer,
                token_count=assistant_tokens,
                created_at=now_ms(),
            )
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

    context = await build_ai_context(db, family_id=family_id, baby_id=baby_id, window_days=7)
    messages = build_query_messages(payload.question, context)
    model_name = "unknown"

    try:
        answer, total_tokens = await call_llm(messages)
        model_name = "openai-compatible"
        await _persist_conversation(
            db=db,
            family_id=family_id,
            baby_id=baby_id,
            asked_by=current_user.user_id,
            question=payload.question,
            answer=answer,
            context_window=f"{context['window']['start']}-{context['window']['end']}",
            status="succeeded",
            model_name=model_name,
            user_tokens=total_tokens,
            assistant_tokens=total_tokens,
            error_message=None,
        )
        await db.commit()
    except Exception as exc:
        await _persist_conversation(
            db=db,
            family_id=family_id,
            baby_id=baby_id,
            asked_by=current_user.user_id,
            question=payload.question,
            answer=None,
            context_window=f"{context['window']['start']}-{context['window']['end']}",
            status="failed",
            model_name=model_name,
            user_tokens=None,
            assistant_tokens=None,
            error_message=str(exc),
        )
        await db.commit()
        raise

    return success(
        {
            "answer": answer,
            "window_start": context["window"]["start"],
            "window_end": context["window"]["end"],
            "disclaimer": disclaimer_text(),
        }
    )


@router.post("/summary")
async def summary_ai(
    payload: AiSummaryRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id = to_db_id(payload.family_id)
    baby_id = to_db_id(payload.baby_id)

    await assert_family_access(db, family_id=family_id, user_id=current_user.user_id)
    await assert_baby_belongs_family(db, baby_id=baby_id, family_id=family_id)

    summary_type = payload.summary_type.lower().strip()
    days = {"daily": 1, "weekly": 7, "monthly": 30}.get(summary_type, 7)
    context = await build_ai_context(db, family_id=family_id, baby_id=baby_id, window_days=days)
    messages = build_summary_messages(summary_type, context)
    answer, total_tokens = await call_llm(messages)

    await _persist_conversation(
        db=db,
        family_id=family_id,
        baby_id=baby_id,
        asked_by=current_user.user_id,
        question=f"generate_{summary_type}_summary",
        answer=answer,
        context_window=f"{context['window']['start']}-{context['window']['end']}",
        status="succeeded",
        model_name="openai-compatible",
        user_tokens=total_tokens,
        assistant_tokens=total_tokens,
    )
    await db.commit()

    return success(
        {
            "summary_type": summary_type,
            "summary_date": payload.summary_date,
            "summary": answer,
            "window_start": context["window"]["start"],
            "window_end": context["window"]["end"],
            "disclaimer": disclaimer_text(),
        }
    )
