from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings
from app.core.errors import AppError

_bearer = HTTPBearer(auto_error=False)

_ALGORITHM = "HS256"
_ACCESS_TOKEN_TTL_MINUTES = 60 * 24
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
    except jwt.ExpiredSignatureError as exc:
        raise AppError("UNAUTHORIZED", "token expired", status_code=401) from exc
    except jwt.InvalidTokenError as exc:
        raise AppError("UNAUTHORIZED", "invalid token", status_code=401) from exc


class CurrentUser:
    """已认证用户上下文。"""

    def __init__(
        self,
        user_id: int,
        family_ids: list[int] | None = None,
        family_roles: dict[int, str] | None = None,
    ) -> None:
        self.user_id = user_id
        self.family_ids = family_ids or []
        self.family_roles = family_roles or {}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> CurrentUser:
    if not credentials:
        raise AppError("UNAUTHORIZED", "missing authorization header", status_code=401)

    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise AppError("UNAUTHORIZED", "invalid token type", status_code=401)

    sub = payload.get("sub")
    if sub is None:
        raise AppError("UNAUTHORIZED", "invalid token payload", status_code=401)

    try:
        user_id = int(str(sub))
        family_ids = [int(str(fid)) for fid in payload.get("family_ids", [])]
    except ValueError as exc:
        raise AppError("UNAUTHORIZED", "invalid token payload", status_code=401) from exc

    raw_roles = payload.get("family_roles", {})
    family_roles: dict[int, str] = {}
    if isinstance(raw_roles, dict):
        for family_id, role in raw_roles.items():
            try:
                family_roles[int(str(family_id))] = str(role)
            except ValueError:
                continue

    return CurrentUser(user_id=user_id, family_ids=family_ids, family_roles=family_roles)
