from typing import Any


def success(data: Any = None, message: str = "success") -> dict[str, Any]:
    return {
        "code": "OK",
        "message": message,
        "data": data if data is not None else {},
    }
