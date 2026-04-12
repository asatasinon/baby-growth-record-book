from typing import Annotated

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/babies", tags=["babies"])


class BabyCreateRequest(BaseModel):
    family_id: IdStr
    name: str
    nickname: str | None = None
    gender: str = "unknown"
    birth_date: int
    birth_weight_g: int | None = None
    birth_height_cm: float | None = None
    birth_head_circumference_cm: float | None = None


class BabyUpdateRequest(BaseModel):
    nickname: str | None = None
    birth_weight_g: int | None = None
    birth_height_cm: float | None = None
    birth_head_circumference_cm: float | None = None


@router.get("")
def list_babies(family_id: Annotated[IdStr, Query()]) -> dict:
    return success(
        [
            {
                "id": "30001",
                "family_id": family_id,
                "name": "小宝",
                "nickname": "豆豆",
                "gender": "unknown",
                "birth_date": 1743379200000,
            }
        ]
    )


@router.post("")
def create_baby(payload: BabyCreateRequest) -> dict:
    return success({"id": "30002", **payload.model_dump()})


@router.get("/{baby_id}")
def get_baby(baby_id: Annotated[IdStr, Path()]) -> dict:
    return success(
        {
            "id": baby_id,
            "family_id": "20001",
            "name": "小宝",
            "nickname": "豆豆",
            "gender": "unknown",
            "birth_date": 1743379200000,
        }
    )


@router.patch("/{baby_id}")
def update_baby(baby_id: Annotated[IdStr, Path()], payload: BabyUpdateRequest) -> dict:
    return success({"id": baby_id, **payload.model_dump(exclude_none=True)})
