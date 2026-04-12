from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import assert_family_owner_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import now_ms
from app.models.family import Family, FamilyMember
from app.models.user import User
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/families", tags=["families"])


class FamilyCreateRequest(BaseModel):
    name: str
    timezone: str = "Asia/Shanghai"


class FamilyMemberCreateRequest(BaseModel):
    user_id: IdStr | None = None
    invitee_phone: str | None = None
    role: Literal["owner", "caregiver", "viewer"]


class FamilyMemberUpdateRequest(BaseModel):
    role: Literal["owner", "caregiver", "viewer"] | None = None
    status: Literal["pending", "active", "removed"] | None = None


@router.get("")
async def list_families(
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
    )
    rows = (await db.execute(stmt)).all()
    payload = [
        {
            "id": to_api_id(f.id),
            "name": f.name,
            "role": fm.role,
            "timezone": f.timezone,
        }
        for fm, f in rows
    ]
    return success(payload)


@router.post("")
async def create_family(
    payload: FamilyCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family = Family(
        name=payload.name,
        timezone=payload.timezone,
        status="active",
        created_by=current_user.user_id,
    )
    db.add(family)
    await db.flush()

    member = FamilyMember(
        family_id=family.id,
        user_id=current_user.user_id,
        role="owner",
        status="active",
        invited_by=current_user.user_id,
        joined_at=now_ms(),
    )
    db.add(member)
    await db.commit()

    return success(
        {
            "id": to_api_id(family.id),
            "name": family.name,
            "role": "owner",
            "timezone": family.timezone,
        }
    )


@router.post("/{family_id}/members")
async def create_family_member(
    family_id: Annotated[IdStr, Path()],
    payload: FamilyMemberCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    await assert_family_owner_access(db, family_id=family_id_int, user_id=current_user.user_id)

    if not payload.user_id and not payload.invitee_phone:
        raise AppError(
            "INVALID_ARGUMENT",
            "user_id or invitee_phone is required",
            {"field": "user_id", "reason": "one of user_id or invitee_phone is required"},
            status_code=400,
        )

    status = "active"
    target_user_id: int

    if payload.user_id:
        target_user_id = to_db_id(payload.user_id)
        target_user = await db.get(User, target_user_id)
        if target_user is None:
            raise AppError(
                "NOT_FOUND",
                "target user not found",
                {"field": "user_id", "value": payload.user_id},
                status_code=404,
            )
    else:
        suffix = payload.invitee_phone[-4:] if payload.invitee_phone else ""
        user = User(display_name=f"待加入成员{suffix}")
        db.add(user)
        await db.flush()
        target_user_id = user.id
        status = "pending"

    existing = await db.scalar(
        select(FamilyMember).where(
            FamilyMember.family_id == family_id_int,
            FamilyMember.user_id == target_user_id,
        )
    )

    if existing is not None:
        existing.role = payload.role
        if status == "active":
            existing.status = "active"
        elif existing.status == "removed":
            existing.status = "pending"
        if existing.status == "active" and existing.joined_at is None:
            existing.joined_at = now_ms()
        member = existing
    else:
        member = FamilyMember(
            family_id=family_id_int,
            user_id=target_user_id,
            role=payload.role,
            status=status,
            invited_by=current_user.user_id,
            joined_at=now_ms() if status == "active" else None,
        )
        db.add(member)

    await db.flush()
    await db.commit()

    return success(
        {
            "id": to_api_id(member.id),
            "family_id": to_api_id(member.family_id),
            "user_id": to_api_id(member.user_id),
            "role": member.role,
            "status": member.status,
        }
    )


@router.patch("/{family_id}/members/{member_id}")
async def update_family_member(
    family_id: Annotated[IdStr, Path()],
    member_id: Annotated[IdStr, Path()],
    payload: FamilyMemberUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    member_id_int = to_db_id(member_id)

    await assert_family_owner_access(db, family_id=family_id_int, user_id=current_user.user_id)

    member = await db.scalar(
        select(FamilyMember).where(
            FamilyMember.id == member_id_int,
            FamilyMember.family_id == family_id_int,
        )
    )
    if member is None:
        raise AppError("NOT_FOUND", "family member not found", status_code=404)

    if payload.role is not None:
        member.role = payload.role
    if payload.status is not None:
        member.status = payload.status
        if payload.status == "active" and member.joined_at is None:
            member.joined_at = now_ms()

    await db.commit()

    return success(
        {
            "id": to_api_id(member.id),
            "family_id": to_api_id(member.family_id),
            "user_id": to_api_id(member.user_id),
            "role": member.role,
            "status": member.status,
        }
    )
