from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import assert_family_access, assert_family_owner_access
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
    family_alias: str | None = None
    city: str | None = None
    address: str | None = None
    notes: str | None = None


class FamilyUpdateRequest(BaseModel):
    name: str | None = None
    timezone: str | None = None
    family_alias: str | None = None
    city: str | None = None
    address: str | None = None
    notes: str | None = None


class FamilyMemberCreateRequest(BaseModel):
    user_id: IdStr | None = None
    invitee_phone: str | None = None
    role: Literal["owner", "caregiver", "viewer"]
    relation_label: str | None = None


class FamilyMemberUpdateRequest(BaseModel):
    role: Literal["owner", "caregiver", "viewer"] | None = None
    status: Literal["pending", "active", "removed"] | None = None
    relation_label: str | None = None


def _family_to_payload(family: Family, member: FamilyMember) -> dict:
    return {
        "id": to_api_id(family.id),
        "name": family.name,
        "role": member.role,
        "timezone": family.timezone,
        "family_alias": family.family_alias,
        "city": family.city,
        "address": family.address,
        "notes": family.notes,
        "relationship": member.relation_label,
    }


def _member_to_payload(member: FamilyMember, user_display_name: str | None) -> dict:
    return {
        "id": to_api_id(member.id),
        "family_id": to_api_id(member.family_id),
        "user_id": to_api_id(member.user_id),
        "user_display_name": user_display_name,
        "role": member.role,
        "status": member.status,
        "relation_label": member.relation_label,
        "joined_at": member.joined_at,
    }


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
    return success([_family_to_payload(family, member) for member, family in rows])


@router.post("")
async def create_family(
    payload: FamilyCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family = Family(
        name=payload.name,
        timezone=payload.timezone,
        family_alias=payload.family_alias,
        city=payload.city,
        address=payload.address,
        notes=payload.notes,
        status="active",
        created_by=current_user.user_id,
    )
    db.add(family)
    await db.flush()

    member = FamilyMember(
        family_id=family.id,
        user_id=current_user.user_id,
        role="owner",
        relation_label="我",
        status="active",
        invited_by=current_user.user_id,
        joined_at=now_ms(),
    )
    db.add(member)
    await db.commit()

    return success(_family_to_payload(family, member))


@router.patch("/{family_id}")
async def update_family(
    family_id: Annotated[IdStr, Path()],
    payload: FamilyUpdateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    actor = await assert_family_owner_access(db, family_id=family_id_int, user_id=current_user.user_id)

    family = await db.get(Family, family_id_int)
    if family is None or family.status != "active":
        raise AppError("NOT_FOUND", "family not found", status_code=404)

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(family, key, value)

    await db.commit()
    return success(_family_to_payload(family, actor))


@router.get("/{family_id}/members")
async def list_family_members(
    family_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    actor = await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    is_owner = actor.role == "owner"

    if is_owner:
        members = list(
            await db.scalars(
                select(FamilyMember)
                .where(
                    FamilyMember.family_id == family_id_int,
                    FamilyMember.status.in_(["pending", "active"]),
                )
                .order_by(FamilyMember.id.asc())
            )
        )
    else:
        members = list(
            await db.scalars(
                select(FamilyMember).where(
                    FamilyMember.family_id == family_id_int,
                    FamilyMember.user_id == current_user.user_id,
                    FamilyMember.status == "active",
                )
            )
        )

    user_ids = [member.user_id for member in members]
    user_rows = (
        await db.execute(select(User.id, User.display_name).where(User.id.in_(user_ids))) if user_ids else None
    )
    user_name_map = {user_id: display_name for user_id, display_name in user_rows.all()} if user_rows else {}

    payload = []
    for member in members:
        row = _member_to_payload(member, user_name_map.get(member.user_id))
        row["can_edit"] = bool(is_owner or member.user_id == current_user.user_id)
        payload.append(row)

    return success(payload)


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
        if payload.relation_label is not None:
            existing.relation_label = payload.relation_label
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
            relation_label=payload.relation_label,
            status=status,
            invited_by=current_user.user_id,
            joined_at=now_ms() if status == "active" else None,
        )
        db.add(member)

    await db.flush()
    await db.commit()

    return success(_member_to_payload(member, None))


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

    actor = await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)
    is_owner = actor.role == "owner"

    member = await db.scalar(
        select(FamilyMember).where(
            FamilyMember.id == member_id_int,
            FamilyMember.family_id == family_id_int,
        )
    )
    if member is None:
        raise AppError("NOT_FOUND", "family member not found", status_code=404)

    if not is_owner:
        if member.user_id != current_user.user_id:
            raise AppError("FORBIDDEN", "cannot edit other members", status_code=403)
        if payload.role is not None or payload.status is not None:
            raise AppError(
                "FORBIDDEN",
                "only owner can update member role or status",
                status_code=403,
            )

    if payload.role is not None and is_owner:
        member.role = payload.role
    if payload.status is not None and is_owner:
        member.status = payload.status
        if payload.status == "active" and member.joined_at is None:
            member.joined_at = now_ms()
    if payload.relation_label is not None:
        member.relation_label = payload.relation_label

    await db.commit()
    return success(_member_to_payload(member, None))
