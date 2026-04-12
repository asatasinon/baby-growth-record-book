from typing import Any

from pydantic import BaseModel


class CommonResponse(BaseModel):
    code: str
    message: str
    data: dict[str, Any] | list[Any] | Any
