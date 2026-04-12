from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.errors import AppError

_bearer = HTTPBearer(auto_error=False)

_ALGORITHM = "HS256"
_ACCESS_TOKEN_TTL_MINUTES = 60 * 24   # 1 day
_REFRESH_TOKEN_TTL_DAYS = 30


def create_access_token(subject: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **subject,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_TTL_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def create_refresh_token(subject: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **subject,
        "iat": now,
        "exp": now + timedelta(days=_REFRESH_TOKEN_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise AppError("UNAUTHORIZED", "token expired", status_code=401)
    except jwt.InvalidTokenError:
        raise AppError("UNAUTHORIZED", "invalid token", status_code=401)


class CurrentUser:
    """已认证用户的上下文，由 get_current_user 依赖注入。"""

    def __init__(self, user_id: int, family_ids: list[int]) -> None:
        self.user_id = user_id
        self.family_ids = family_ids

    def assert_family_access(self, family_id: int) -> None:
        """确认调用方对目标 family 拥有访问权，否则抛出 FORBIDDEN。"""
        if family_id not in self.family_ids:
            raise AppError("FORBIDDEN", "no access to this family", status_code=403)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if not credentials:
        raise AppError("UNAUTHORIZED", "missing authorization header", status_code=401)
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise AppError("UNAUTHORIZED", "invalid token type", status_code=401)
    sub = payload.get("sub")
    if not sub:
        raise AppError("UNAUTHORIZED", "invalid token payload", status_code=401)
    return CurrentUser(
        user_id=int(sub),
        family_ids=[int(fid) for fid in payload.get("family_ids", [])],
    )
