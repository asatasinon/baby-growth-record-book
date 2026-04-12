from pydantic import BaseModel
from fastapi import APIRouter

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/ai", tags=["ai"])


class AiQueryRequest(BaseModel):
    family_id: IdStr
    baby_id: IdStr
    question: str


@router.post("/query")
def query_ai(payload: AiQueryRequest) -> dict:
    return success(
        {
            "answer": f"收到问题：{payload.question}",
            "window_start": 1743811200000,
            "window_end": 1744416000000,
            "disclaimer": "结果基于记录数据生成，不替代医生建议。",
        }
    )
