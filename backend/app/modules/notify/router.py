from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.errors import AppError
from app.core.permissions import assert_family_access, assert_family_write_access
from app.core.response import success
from app.core.security import CurrentUser, get_current_user
from app.core.time_utils import now_ms
from app.models.alert import AlertEvent, AlertRule
from app.schemas.id_types import IdStr, to_api_id, to_db_id

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertRuleCreateRequest(BaseModel):
    family_id: IdStr
    rule_type: str
    threshold_value: float | None = None
    window_hours: int | None = None
    window_days: int | None = None
    severity: Literal["info", "warning", "high"]
    enabled: bool = True


def _to_float(value: Decimal | float | None) -> float | None:
    if value is None:
        return None
    return float(value)


@router.get("")
async def list_alerts(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr | None, Query()] = None,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(family_id)
    await assert_family_access(db, family_id=family_id_int, user_id=current_user.user_id)

    stmt = select(AlertEvent).where(AlertEvent.family_id == family_id_int)
    if baby_id is not None:
        stmt = stmt.where(AlertEvent.baby_id == to_db_id(baby_id))

    alerts = await db.scalars(stmt.order_by(AlertEvent.triggered_at.desc(), AlertEvent.id.desc()))
    payload = [
        {
            "id": to_api_id(item.id),
            "family_id": to_api_id(item.family_id),
            "baby_id": to_api_id(item.baby_id),
            "severity": item.severity,
            "title": item.title,
            "content": item.content,
            "status": item.status,
            "triggered_at": item.triggered_at,
            "acknowledged_at": item.acknowledged_at,
            "resolved_at": item.resolved_at,
        }
        for item in alerts
    ]
    return success(payload)


@router.post("/rules")
async def create_rule(
    payload: AlertRuleCreateRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    family_id_int = to_db_id(payload.family_id)
    await assert_family_write_access(db, family_id=family_id_int, user_id=current_user.user_id)

    rule = AlertRule(
        family_id=family_id_int,
        rule_type=payload.rule_type,
        threshold_value=payload.threshold_value,
        window_hours=payload.window_hours,
        window_days=payload.window_days,
        severity=payload.severity,
        enabled=payload.enabled,
        config={},
        created_by=current_user.user_id,
    )
    db.add(rule)
    await db.flush()
    await db.commit()

    return success(
        {
            "id": to_api_id(rule.id),
            "family_id": to_api_id(rule.family_id),
            "rule_type": rule.rule_type,
            "threshold_value": _to_float(rule.threshold_value),
            "window_hours": rule.window_hours,
            "window_days": rule.window_days,
            "severity": rule.severity,
            "enabled": rule.enabled,
        }
    )


@router.patch("/{alert_id}/ack")
async def acknowledge_alert(
    alert_id: Annotated[IdStr, Path()],
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    alert = await db.get(AlertEvent, to_db_id(alert_id))
    if alert is None:
        raise AppError("NOT_FOUND", "alert not found", status_code=404)

    await assert_family_access(db, family_id=alert.family_id, user_id=current_user.user_id)

    if alert.status == "open":
        alert.status = "acknowledged"
        alert.acknowledged_at = now_ms()
        await db.commit()

    return success(
        {
            "id": to_api_id(alert.id),
            "status": alert.status,
            "acknowledged_at": alert.acknowledged_at,
        }
    )
