from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.response import success
from app.core.security import create_access_token, create_refresh_token
from app.core.time_utils import now_ms
from app.models.family import Family, FamilyMember
from app.models.user import User, UserIdentity
from app.schemas.auth import WechatLoginRequest
from app.schemas.id_types import to_api_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/wechat/login")
async def wechat_login(
    payload: WechatLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    openid = f"wechat_mp:{payload.code}"

    identity = await db.scalar(
        select(UserIdentity).where(
            UserIdentity.provider == "wechat_mp",
            UserIdentity.openid_ciphertext == openid,
        )
    )

    if identity is None:
        suffix = payload.code[-4:] if len(payload.code) >= 4 else payload.code
        user = User(display_name=f"家长{suffix or '用户'}")
        db.add(user)
        await db.flush()

        identity = UserIdentity(
            user_id=user.id,
            provider="wechat_mp",
            openid_ciphertext=openid,
            unionid_ciphertext=None,
        )
        db.add(identity)
    else:
        user = await db.get(User, identity.user_id)
        if user is None:
            user = User(id=identity.user_id, display_name="家长")
            db.add(user)
            await db.flush()

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

    return success(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": to_api_id(user.id), "display_name": user.display_name},
            "families": families,
        }
    )
