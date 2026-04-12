from typing import Annotated

from fastapi import APIRouter, Path, Query
from pydantic import BaseModel

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/alerts", tags=["alerts"])


class AlertRuleCreateRequest(BaseModel):
    family_id: IdStr
    rule_type: str
    threshold_value: float | None = None
    window_hours: int | None = None
    window_days: int | None = None
    severity: str
    enabled: bool = True


@router.get("")
def list_alerts(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr | None, Query()] = None,
) -> dict:
    return success(
        [
            {
                "id": "50001",
                "family_id": family_id,
                "baby_id": baby_id or "30001",
                "severity": "warning",
                "title": "喂养间隔偏长",
                "status": "open",
            }
        ]
    )


@router.post("/rules")
def create_rule(payload: AlertRuleCreateRequest) -> dict:
    return success({"id": "51001", **payload.model_dump()})


@router.patch("/{alert_id}/ack")
def acknowledge_alert(alert_id: Annotated[IdStr, Path()]) -> dict:
    return success({"id": alert_id, "status": "acknowledged"})
