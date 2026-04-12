from fastapi import APIRouter

from app.core.response import success
from app.schemas.auth import WechatLoginRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/wechat/login")
def wechat_login(payload: WechatLoginRequest) -> dict:
    return success(
        {
            "access_token": "mock-access-token",
            "refresh_token": "mock-refresh-token",
            "user": {"id": "10001", "display_name": "家长"},
            "families": [{"id": "20001", "name": "默认家庭", "role": "owner"}],
            "debug": {"wechat_code": payload.code},
        }
    )
