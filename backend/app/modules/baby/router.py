from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import assert_family_access, assert_family_write_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.models.baby import Baby
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/babies", tags=["babies"])


class BabyCreateRequest(BaseModel):
    family_id: IdStr
    name: str
    nickname: str | None = None
    gender: Literal["male", "female", "unknown"] = "unknown"
    birth_date: int
    birth_weight_g: int | None = None
    birth_height_cm: float | None = None
    birth_head_circumference_cm: float | None = None


class BabyUpdateRequest(BaseModel):
    nickname: str | None = None
    birth_weight_g: int | None = None
    birth_height_cm: float | None = None
    birth_head_circumference_cm: float | None = None


def _to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


def _baby_to_payload(baby: Baby) -> dict:
    return {
        "id": to_api_id(baby.id),
        "family_id": to_api_id(baby.family_id),
        "name": baby.name,
        "nickname": baby.nickname,
        "gender": baby.gender,
        "birth_date": baby.birth_date,
        "birth_weight_g": baby.birth_weight_g,
        "birth_height_cm": _to_float(baby.birth_height_cm),
        "birth_head_circumference_cm": _to_float(baby.birth_head_circumference_cm),
    }


@router.get("")
async def list_babies(
    family_id: Annotated[IdStr, Query()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)

    babies = await db.scalars(
        select(Baby)
        .where(Baby.family_id == family_id_int, Baby.status == "active")
        .order_by(Baby.id.asc())
    )
    return success([_baby_to_payload(item) for item in babies])


@router.post("")
async def create_baby(
    payload: BabyCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(payload.family_id)
    await assert_family_write_access(db, family_id=family_id_int, user_id=current_user.user_id)

    baby = Baby(
        family_id=family_id_int,
        name=payload.name,
        nickname=payload.nickname,
        gender=payload.gender,
        birth_date=payload.birth_date,
        birth_weight_g=payload.birth_weight_g,
        birth_height_cm=payload.birth_height_cm,
        birth_head_circumference_cm=payload.birth_head_circumference_cm,
        status="active",
    )
    db.add(baby)
    await db.flush()
    await db.commit()

    return success(_baby_to_payload(baby))


@router.get("/{baby_id}")
async def get_baby(
    baby_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    baby = await db.get(Baby, to_db_id(baby_id))
    if baby is None or baby.status != "active":
        raise AppError("NOT_FOUND", "baby not found", status_code=404)

    await assert_family_access(db, family_id=baby.family_id, user_id=current_user.user_id)
    return success(_baby_to_payload(baby))


@router.patch("/{baby_id}")
async def update_baby(
    baby_id: Annotated[IdStr, Path()],
    payload: BabyUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    baby = await db.get(Baby, to_db_id(baby_id))
    if baby is None or baby.status != "active":
        raise AppError("NOT_FOUND", "baby not found", status_code=404)

    await assert_family_write_access(db, family_id=baby.family_id, user_id=current_user.user_id)

    changes = payload.model_dump(exclude_none=True)
    for key, value in changes.items():
        setattr(baby, key, value)

    await db.commit()
    return success(_baby_to_payload(baby))
