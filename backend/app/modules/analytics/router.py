from typing import Annotated

from fastapi import APIRouter, Query

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/trends")
def get_trends(
    family_id: Annotated[IdStr, Query()],
    baby_id: Annotated[IdStr, Query()],
    metric_code: Annotated[str, Query()],
    date_from: Annotated[int, Query()],
    date_to: Annotated[int, Query()],
    bucket: Annotated[str, Query()] = "day",
) -> dict:
    return success(
        {
            "family_id": family_id,
            "baby_id": baby_id,
            "metric_code": metric_code,
            "unit": "ml",
            "bucket": bucket,
            "window": {"date_from": date_from, "date_to": date_to},
            "points": [
                {"bucket_date": date_from, "value": 520},
                {"bucket_date": date_to, "value": 560},
            ],
        }
    )
