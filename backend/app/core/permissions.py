from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models.baby import Baby
from app.models.family import FamilyMember

_WRITABLE_ROLES = {"owner", "caregiver"}


async def get_family_member(
    session: AsyncSession,
    *,
    family_id: int,
    user_id: int,
) -> FamilyMember | None:
    stmt = select(FamilyMember).where(
        FamilyMember.family_id == family_id,
        FamilyMember.user_id == user_id,
        FamilyMember.status == "active",
    )
    return await session.scalar(stmt)


async def assert_family_access(
    session: AsyncSession,
    *,
    family_id: int,
    user_id: int,
) -> FamilyMember:
    member = await get_family_member(session, family_id=family_id, user_id=user_id)
    if member is None:
        raise AppError("FORBIDDEN", "no access to this family", status_code=403)
    return member


async def assert_family_write_access(
    session: AsyncSession,
    *,
    family_id: int,
    user_id: int,
) -> FamilyMember:
    member = await assert_family_access(session, family_id=family_id, user_id=user_id)
    if member.role not in _WRITABLE_ROLES:
        raise AppError("FORBIDDEN", "read-only role cannot modify data", status_code=403)
    return member


async def assert_family_owner_access(
    session: AsyncSession,
    *,
    family_id: int,
    user_id: int,
) -> FamilyMember:
    member = await assert_family_access(session, family_id=family_id, user_id=user_id)
    if member.role != "owner":
        raise AppError("FORBIDDEN", "owner role required", status_code=403)
    return member


async def list_accessible_family_ids(session: AsyncSession, *, user_id: int) -> list[int]:
    stmt = select(FamilyMember.family_id).where(
        FamilyMember.user_id == user_id,
        FamilyMember.status == "active",
    )
    rows = await session.scalars(stmt)
    return list(rows)


async def assert_baby_belongs_family(
    session: AsyncSession,
    *,
    baby_id: int,
    family_id: int,
) -> Baby:
    baby = await session.get(Baby, baby_id)
    if baby is None or baby.status != "active" or baby.family_id != family_id:
        raise AppError(
            "INVALID_ARGUMENT",
            "baby does not belong to family",
            {"field": "baby_id", "value": str(baby_id)},
            status_code=400,
        )
    return baby
