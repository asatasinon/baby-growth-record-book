from typing import Annotated

from fastapi import APIRouter, Query

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/summaries", tags=["summaries"])


@router.get("/daily")
def get_daily_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    date: Annotated[int, Query()],
) -> dict:
    return success(
        {
            "family_id": family_id,
            "baby_id": baby_id,
            "summary_date": date,
            "feeding_total_ml": 560,
            "feeding_breakdown": {"formula": 560},
            "excretion_count_total": 5,
            "excretion_breakdown": {"urine": 4, "stool": 1},
            "sleep_total_minutes": 780,
            "last_measurement_snapshot": {},
            "alerts": [],
        }
    )


@router.get("/weekly")
def get_weekly_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    week_start: Annotated[int, Query()],
) -> dict:
    return success(
        {
            "family_id": family_id,
            "baby_id": baby_id,
            "week_start": week_start,
            "summary_payload": {},
        }
    )


@router.get("/monthly")
def get_monthly_summary(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    month: Annotated[int, Query()],
) -> dict:
    return success(
        {
            "family_id": family_id,
            "baby_id": baby_id,
            "month": month,
            "summary_payload": {},
        }
    )
