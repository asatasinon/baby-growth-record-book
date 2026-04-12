from typing import Annotated

from pydantic import AfterValidator, Field

_MAX_BIGINT = 9_223_372_036_854_775_807


def _validate_bigint_range(value: str) -> str:
    parsed = int(value)
    if parsed > _MAX_BIGINT:
        raise ValueError(f"must be <= {_MAX_BIGINT}")
    return value


IdStr = Annotated[
    str,
    Field(pattern=r"^[0-9]+$"),
    AfterValidator(_validate_bigint_range),
]


def to_db_id(value: IdStr) -> int:
    parsed = int(value)
    if parsed > _MAX_BIGINT:
        raise ValueError(f"must be <= {_MAX_BIGINT}")
    return parsed


def to_api_id(value: int | None) -> str | None:
    if value is None:
        return None
    return str(value)
