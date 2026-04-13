import base64
import hashlib
import hmac
import secrets
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
_PASSWORD_ALGORITHM = "pbkdf2_sha256"
_PASSWORD_ITERATIONS = 120_000
_PASSWORD_SALT_BYTES = 16
_PHONE_CIPHER_PREFIX = "enc:v1:"
_revoked_jti: set[str] = set()


def _phone_cipher_key() -> bytes:
    return hashlib.sha256(f"{get_settings().app_secret}:phone".encode("utf-8")).digest()


def _xor_stream(data: bytes, key: bytes) -> bytes:
    result = bytearray()
    counter = 0
    seed = key
    while len(result) < len(data):
        block = hashlib.sha256(seed + counter.to_bytes(8, "big")).digest()
        result.extend(block)
        counter += 1
    return bytes(a ^ b for a, b in zip(data, result[: len(data)], strict=True))


def encrypt_phone(value: str) -> str:
    if value.startswith(_PHONE_CIPHER_PREFIX):
        return value
    cipher_bytes = _xor_stream(value.encode("utf-8"), _phone_cipher_key())
    encoded = base64.urlsafe_b64encode(cipher_bytes).decode("ascii")
    return f"{_PHONE_CIPHER_PREFIX}{encoded}"


def decrypt_phone(value: str | None) -> str | None:
    if value is None:
        return None
    if not value.startswith(_PHONE_CIPHER_PREFIX):
        # 兼容历史明文存储数据。
        return value
    encoded = value.removeprefix(_PHONE_CIPHER_PREFIX)
    try:
        cipher_bytes = base64.urlsafe_b64decode(encoded.encode("ascii"))
        plain = _xor_stream(cipher_bytes, _phone_cipher_key()).decode("utf-8")
    except Exception:
        return None
    return plain


def create_access_token(subject: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **subject,
        "iat": now,
        "exp": now + timedelta(minutes=_ACCESS_TOKEN_TTL_MINUTES),
        "type": "access",
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def create_refresh_token(subject: dict[str, Any]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        **subject,
        "iat": now,
        "exp": now + timedelta(days=_REFRESH_TOKEN_TTL_DAYS),
        "type": "refresh",
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(payload, get_settings().jwt_secret, algorithm=_ALGORITHM)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_PASSWORD_SALT_BYTES)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _PASSWORD_ITERATIONS,
    )
    salt_encoded = base64.urlsafe_b64encode(salt).decode("ascii")
    digest_encoded = base64.urlsafe_b64encode(digest).decode("ascii")
    return f"{_PASSWORD_ALGORITHM}${_PASSWORD_ITERATIONS}${salt_encoded}${digest_encoded}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        algorithm, iterations_raw, salt_encoded, digest_encoded = hashed.split("$", maxsplit=3)
        if algorithm != _PASSWORD_ALGORITHM:
            return False
        iterations = int(iterations_raw)
        salt = base64.urlsafe_b64decode(salt_encoded.encode("ascii"))
        expected_digest = base64.urlsafe_b64decode(digest_encoded.encode("ascii"))
    except (TypeError, ValueError):
        return False

    calculated_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(calculated_digest, expected_digest)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, get_settings().jwt_secret, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise AppError("UNAUTHORIZED", "token expired", status_code=401) from exc
    except jwt.InvalidTokenError as exc:
        raise AppError("UNAUTHORIZED", "invalid token", status_code=401) from exc


def revoke_token(token_payload: dict[str, Any]) -> None:
    jti = token_payload.get("jti")
    if isinstance(jti, str) and jti:
        _revoked_jti.add(jti)


def is_token_revoked(token_payload: dict[str, Any]) -> bool:
    jti = token_payload.get("jti")
    return bool(isinstance(jti, str) and jti and jti in _revoked_jti)


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
    if is_token_revoked(payload):
        raise AppError("UNAUTHORIZED", "token revoked", status_code=401)
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
