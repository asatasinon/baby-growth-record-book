from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.permissions import list_accessible_family_ids
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.models.baby import Baby
from app.models.event import GrowthEvent
from app.models.family import Family, FamilyMember
from app.schemas.id_types import to_api_id

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


@router.get("/families")
async def admin_list_families(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = (
        select(FamilyMember, Family)
        .join(Family, Family.id == FamilyMember.family_id)
        .where(
            FamilyMember.user_id == current_user.user_id,
            FamilyMember.status == "active",
            Family.status == "active",
        )
        .order_by(Family.id.asc())
    )
    rows = (await db.execute(stmt)).all()
    payload = [
        {
            "id": to_api_id(f.id),
            "name": f.name,
            "role": m.role,
            "timezone": f.timezone,
        }
        for m, f in rows
    ]
    return success(payload)


@router.get("/babies")
async def admin_list_babies(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_ids = await list_accessible_family_ids(db, user_id=current_user.user_id)
    if not family_ids:
        return success([])

    babies = await db.scalars(
        select(Baby)
        .where(Baby.family_id.in_(family_ids), Baby.status == "active")
        .order_by(Baby.id.asc())
    )
    payload = [
        {
            "id": to_api_id(item.id),
            "family_id": to_api_id(item.family_id),
            "name": item.name,
            "nickname": item.nickname,
            "gender": item.gender,
            "birth_date": item.birth_date,
            "birth_weight_g": item.birth_weight_g,
            "birth_height_cm": _to_float(item.birth_height_cm),
            "birth_head_circumference_cm": _to_float(item.birth_head_circumference_cm),
        }
        for item in babies
    ]
    return success(payload)


@router.get("/events")
async def admin_list_events(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_ids = await list_accessible_family_ids(db, user_id=current_user.user_id)
    if not family_ids:
        return success([])

    events = await db.scalars(
        select(GrowthEvent)
        .where(GrowthEvent.family_id.in_(family_ids), GrowthEvent.status != "deleted")
        .order_by(GrowthEvent.occurred_at.desc(), GrowthEvent.id.desc())
    )
    payload = [
        {
            "id": to_api_id(item.id),
            "family_id": to_api_id(item.family_id),
            "baby_id": to_api_id(item.baby_id),
            "event_type": item.event_type,
            "occurred_at": item.occurred_at,
            "start_at": item.start_at,
            "end_at": item.end_at,
            "timezone": item.timezone,
            "notes": item.notes,
            "payload": item.payload_snapshot,
            "status": item.status,
        }
        for item in events
    ]
    return success(payload)
