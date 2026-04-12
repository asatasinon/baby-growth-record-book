from typing import Annotated

from pydantic import Field

IdStr = Annotated[str, Field(pattern=r"^[0-9]+$")]


def to_db_id(value: IdStr) -> int:
    return int(value)


def to_api_id(value: int | None) -> str | None:
    if value is None:
        return None
    return str(value)
