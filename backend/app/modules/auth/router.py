from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.response import success
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
)
from app.core.time_utils import now_ms
from app.models.family import Family, FamilyMember
from app.models.user import User, UserIdentity
from app.schemas.auth import PasswordLoginRequest, WechatLoginRequest
from app.schemas.id_types import to_api_id

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_phone(raw_value: str | None) -> str | None:
    if raw_value is None:
        return None
    value = raw_value.strip().replace(" ", "").replace("-", "")
    if value.startswith("+86"):
        value = value[3:]
    if value.startswith("86") and len(value) == 13:
        value = value[2:]
    return value


def _validate_phone_or_raise(phone: str | None) -> str:
    if phone and len(phone) == 11 and phone.startswith("1") and phone.isdigit():
        return phone
    raise AppError(
        "INVALID_ARGUMENT",
        "invalid phone number",
        data={"field": "phone", "reason": "must match ^1\\d{10}$", "value": phone},
        status_code=400,
    )


async def _find_user_by_phone(phone: str, db: AsyncSession) -> User | None:
    users = list(
        (
            await db.execute(
                select(User).where(User.phone_ciphertext == phone).order_by(User.id.asc()).limit(2)
            )
        )
        .scalars()
        .all()
    )
    if len(users) > 1:
        raise AppError(
            "CONFLICT",
            "duplicated users found for phone",
            data={"phone": phone},
            status_code=409,
        )
    return users[0] if users else None


def _ensure_user_is_active(user: User) -> None:
    if user.status != "active":
        raise AppError("FORBIDDEN", "user is disabled", status_code=403)


async def _build_login_data(user: User, db: AsyncSession) -> dict:
    login_at = now_ms()
    user.last_login_at = login_at

    memberships = await db.execute(
        select(FamilyMember, Family)
        .join(Family, Family.id == FamilyMember.family_id)
        .where(
            FamilyMember.user_id == user.id,
            FamilyMember.status == "active",
            Family.status == "active",
        )
    )
    rows = list(memberships.all())

    if not rows:
        default_family = Family(
            name=f"{user.display_name}的家庭",
            timezone="Asia/Shanghai",
            status="active",
            created_by=user.id,
        )
        db.add(default_family)
        await db.flush()

        default_member = FamilyMember(
            family_id=default_family.id,
            user_id=user.id,
            role="owner",
            status="active",
            invited_by=user.id,
            joined_at=login_at,
        )
        db.add(default_member)
        await db.flush()

        rows = [(default_member, default_family)]

    await db.commit()

    family_ids = [fm.family_id for fm, _ in rows]
    family_roles = {str(fm.family_id): fm.role for fm, _ in rows}

    subject = {
        "sub": str(user.id),
        "family_ids": family_ids,
        "family_roles": family_roles,
    }

    access_token = create_access_token(subject)
    refresh_token = create_refresh_token(subject)

    families = [
        {
            "id": to_api_id(f.id),
            "name": f.name,
            "role": fm.role,
            "timezone": f.timezone,
        }
        for fm, f in rows
    ]

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {"id": to_api_id(user.id), "display_name": user.display_name},
        "families": families,
    }


@router.post("/wechat/login")
async def wechat_login(
    payload: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    normalized_phone = _normalize_phone(payload.phone or payload.encrypted_phone_data)
    phone = _validate_phone_or_raise(normalized_phone)
    openid = f"wechat_mp:{payload.code}"

    identity = await db.scalar(
        select(UserIdentity).where(
            UserIdentity.provider == "wechat_mp",
            UserIdentity.openid_ciphertext == openid,
        )
    )
    user_by_phone = await _find_user_by_phone(phone, db)

    if identity is None and user_by_phone is None:
        user = User(display_name=f"家长{phone[-4:]}", phone_ciphertext=phone)
        db.add(user)
        await db.flush()

        identity = UserIdentity(
            user_id=user.id,
            provider="wechat_mp",
            openid_ciphertext=openid,
            unionid_ciphertext=None,
        )
        db.add(identity)
    elif identity is None and user_by_phone is not None:
        user = user_by_phone
        _ensure_user_is_active(user)
        identity_by_user = await db.scalar(
            select(UserIdentity).where(
                UserIdentity.user_id == user.id,
                UserIdentity.provider == "wechat_mp",
            )
        )
        if identity_by_user is None:
            identity = UserIdentity(
                user_id=user.id,
                provider="wechat_mp",
                openid_ciphertext=openid,
                unionid_ciphertext=None,
            )
            db.add(identity)
        else:
            identity_by_user.openid_ciphertext = openid
    else:
        user = await db.get(User, identity.user_id)
        if user is None:
            user = User(
                id=identity.user_id,
                display_name=f"家长{phone[-4:]}",
                phone_ciphertext=phone,
            )
            db.add(user)
            await db.flush()
        if user_by_phone is not None and user_by_phone.id != user.id:
            raise AppError(
                "CONFLICT",
                "phone is already bound to another account",
                status_code=409,
            )
        if user.phone_ciphertext is None:
            user.phone_ciphertext = phone
        elif user.phone_ciphertext != phone:
            raise AppError(
                "CONFLICT",
                "wechat account is bound to a different phone",
                status_code=409,
            )
        _ensure_user_is_active(user)

    return success(await _build_login_data(user, db))


@router.post("/password/login")
async def password_login(
    payload: PasswordLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    phone = _validate_phone_or_raise(_normalize_phone(payload.phone))
    user = await _find_user_by_phone(phone, db)

    if user is None:
        user = User(
            display_name=f"家长{phone[-4:]}",
            phone_ciphertext=phone,
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        await db.flush()
    else:
        _ensure_user_is_active(user)
        if user.password_hash is None:
            # MVP：首次手机号密码登录时补齐密码凭证。
            user.password_hash = hash_password(payload.password)
        elif not verify_password(payload.password, user.password_hash):
            raise AppError("UNAUTHORIZED", "invalid phone or password", status_code=401)

    return success(await _build_login_data(user, db))
