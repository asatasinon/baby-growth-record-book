import httpx
from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.core.errors import AppError
from app.core.response import success
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decrypt_phone,
    encrypt_phone,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)
from app.core.time_utils import now_ms
from app.models.family import Family, FamilyMember
from app.models.user import User, UserIdentity
from app.schemas.auth import (
    LogoutRequest,
    PasswordLoginRequest,
    PasswordRegisterRequest,
    RefreshTokenRequest,
    WechatLoginRequest,
)
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
    encrypted_phone = encrypt_phone(phone)
    users = list(
        (
            await db.execute(
                select(User)
                .where(User.phone_ciphertext.in_([encrypted_phone, phone]))
                .order_by(User.id.asc())
                .limit(2)
            )
        )
        .scalars()
        .all()
    )
    if len(users) > 1:
        raise AppError(
            "CONFLICT",
            "duplicated users found for phone",
            data={"phone": phone[-4:]},
            status_code=409,
        )
    return users[0] if users else None


def _phone_cipher_matches(phone_ciphertext: str | None, expected_phone: str) -> bool:
    plain_value = decrypt_phone(phone_ciphertext)
    return plain_value == expected_phone


async def _fetch_wechat_session(code: str) -> tuple[str, str | None]:
    settings = get_settings()
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise AppError(
            "INTERNAL_ERROR",
            "wechat login config missing",
            data={"required": ["WECHAT_APP_ID", "WECHAT_APP_SECRET"]},
            status_code=500,
        )

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            response = await client.get(
                "https://api.weixin.qq.com/sns/jscode2session",
                params={
                    "appid": settings.wechat_app_id,
                    "secret": settings.wechat_app_secret,
                    "js_code": code,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError as exc:
        raise AppError("UNAUTHORIZED", "wechat api unavailable", status_code=401) from exc

    if response.status_code != 200:
        raise AppError("UNAUTHORIZED", "wechat login failed", status_code=401)

    payload = response.json()
    errcode = payload.get("errcode")
    if errcode:
        raise AppError(
            "INVALID_ARGUMENT",
            "invalid wechat login code",
            data={"field": "code", "reason": str(payload.get("errmsg", "wechat error"))},
            status_code=400,
        )

    openid = payload.get("openid")
    if not isinstance(openid, str) or not openid:
        raise AppError("UNAUTHORIZED", "wechat openid missing", status_code=401)

    unionid = payload.get("unionid")
    return openid, str(unionid) if unionid else None


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
            "family_alias": f.family_alias,
            "city": f.city,
            "address": f.address,
            "notes": f.notes,
            "relationship": fm.relation_label,
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
    openid, unionid = await _fetch_wechat_session(payload.code)
    openid_ciphertext = f"wechat_mp:{openid}"
    unionid_ciphertext = f"wechat_mp:{unionid}" if unionid else None

    identity = await db.scalar(
        select(UserIdentity).where(
            UserIdentity.provider == "wechat_mp",
            UserIdentity.openid_ciphertext == openid_ciphertext,
        )
    )
    user_by_phone = await _find_user_by_phone(phone, db)

    if identity is None and user_by_phone is None:
        user = User(display_name=f"家长{phone[-4:]}", phone_ciphertext=encrypt_phone(phone))
        db.add(user)
        await db.flush()

        identity = UserIdentity(
            user_id=user.id,
            provider="wechat_mp",
            openid_ciphertext=openid_ciphertext,
            unionid_ciphertext=unionid_ciphertext,
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
                openid_ciphertext=openid_ciphertext,
                unionid_ciphertext=unionid_ciphertext,
            )
            db.add(identity)
        else:
            identity_by_user.openid_ciphertext = openid_ciphertext
            identity_by_user.unionid_ciphertext = unionid_ciphertext
    else:
        user = await db.get(User, identity.user_id)
        if user is None:
            user = User(
                id=identity.user_id,
                display_name=f"家长{phone[-4:]}",
                phone_ciphertext=encrypt_phone(phone),
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
            user.phone_ciphertext = encrypt_phone(phone)
        elif not _phone_cipher_matches(user.phone_ciphertext, phone):
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
        raise AppError(
            "UNAUTHORIZED",
            "account not registered",
            data={"field": "phone", "reason": "please register first"},
            status_code=401,
        )
    _ensure_user_is_active(user)

    if user.password_hash is None:
        raise AppError(
            "UNAUTHORIZED",
            "password not set for this account",
            data={"field": "password", "reason": "please register first"},
            status_code=401,
        )
    if not verify_password(payload.password, user.password_hash):
        raise AppError("UNAUTHORIZED", "invalid phone or password", status_code=401)

    return success(await _build_login_data(user, db))


@router.post("/register")
async def password_register(
    payload: PasswordRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    phone = _validate_phone_or_raise(_normalize_phone(payload.phone))
    display_name = payload.display_name.strip() if payload.display_name else ""
    user = await _find_user_by_phone(phone, db)

    if user is None:
        user = User(
            display_name=display_name or f"家长{phone[-4:]}",
            phone_ciphertext=encrypt_phone(phone),
            password_hash=hash_password(payload.password),
        )
        db.add(user)
        await db.flush()
    else:
        _ensure_user_is_active(user)
        if user.password_hash is not None:
            raise AppError("CONFLICT", "phone already registered", status_code=409)
        user.password_hash = hash_password(payload.password)
        if display_name:
            user.display_name = display_name

    return success(await _build_login_data(user, db))


@router.post("/refresh")
async def refresh_token(
    payload: RefreshTokenRequest,
) -> dict:
    token_payload = decode_token(payload.refresh_token)
    if token_payload.get("type") != "refresh":
        raise AppError("UNAUTHORIZED", "invalid token type", status_code=401)
    if is_token_revoked(token_payload):
        raise AppError("UNAUTHORIZED", "token revoked", status_code=401)
    if token_payload.get("sub") is None:
        raise AppError("UNAUTHORIZED", "invalid token payload", status_code=401)

    # 刷新时吊销旧 refresh token，生成全新 access + refresh。
    revoke_token(token_payload)
    subject = {
        "sub": str(token_payload["sub"]),
        "family_ids": token_payload.get("family_ids", []),
        "family_roles": token_payload.get("family_roles", {}),
    }
    return success(
        {
            "access_token": create_access_token(subject),
            "refresh_token": create_refresh_token(subject),
        }
    )


@router.post("/logout")
async def logout(
    payload: LogoutRequest | None = None,
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    revoked_count = 0
    candidates = []
    if payload is not None:
        candidates.extend([payload.access_token, payload.refresh_token])
    if authorization and authorization.lower().startswith("bearer "):
        candidates.append(authorization[7:].strip())

    for token in candidates:
        if not token:
            continue
        try:
            token_payload = decode_token(token)
        except AppError:
            continue
        revoke_token(token_payload)
        revoked_count += 1

    return success({"revoked_token_count": revoked_count})
