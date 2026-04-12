from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        data: dict[str, Any] | None = None,
        status_code: int = 400,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.data = data or {}
        self.status_code = status_code


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "data": exc.data,
        },
    )


async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first_error = exc.errors()[0] if exc.errors() else {}
    location = first_error.get("loc", [])
    field_parts = [str(item) for item in location if item not in ("body", "query", "path")]
    field_name = ".".join(field_parts) if field_parts else "unknown"
    value = first_error.get("input")
    reason = first_error.get("msg", "invalid argument")

    if first_error.get("type") == "string_pattern_mismatch":
        reason = "must match ^[0-9]+$"

    return JSONResponse(
        status_code=400,
        content={
            "code": "INVALID_ARGUMENT",
            "message": "invalid argument",
            "data": {
                "field": field_name,
                "reason": reason,
                "value": value,
            },
        },
    )


async def unhandled_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "message": "internal server error",
            "data": {},
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)
