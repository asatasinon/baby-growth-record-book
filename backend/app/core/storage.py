from functools import lru_cache

import boto3
from botocore.config import Config

from app.core.config import Settings, get_settings
from app.core.errors import AppError


def _validate_storage_settings(settings: Settings) -> None:
    if (
        settings.oss_endpoint
        and settings.oss_bucket
        and settings.oss_access_key
        and settings.oss_secret_key
    ):
        return
    raise AppError(
        "INTERNAL_ERROR",
        "oss config is incomplete",
        data={
            "required": [
                "OSS_ENDPOINT",
                "OSS_BUCKET",
                "OSS_ACCESS_KEY",
                "OSS_SECRET_KEY",
            ]
        },
        status_code=500,
    )


@lru_cache(maxsize=1)
def _build_s3_client():
    settings = get_settings()
    _validate_storage_settings(settings)

    return boto3.client(
        "s3",
        endpoint_url=settings.oss_endpoint,
        aws_access_key_id=settings.oss_access_key,
        aws_secret_access_key=settings.oss_secret_key,
        config=Config(signature_version="s3v4"),
    )


def upload_object(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    settings = get_settings()
    _validate_storage_settings(settings)
    client = _build_s3_client()

    client.put_object(
        Bucket=settings.oss_bucket,
        Key=key,
        Body=data,
        ContentType=content_type,
    )

    # 默认返回 24 小时有效下载链接。
    return generate_presigned_url(key, expires_seconds=86_400)


def generate_presigned_url(key: str, expires_seconds: int = 86_400) -> str:
    settings = get_settings()
    _validate_storage_settings(settings)
    client = _build_s3_client()

    return str(
        client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.oss_bucket, "Key": key},
            ExpiresIn=expires_seconds,
        )
    )
