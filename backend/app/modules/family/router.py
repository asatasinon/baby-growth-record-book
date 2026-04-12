from typing import Annotated

from fastapi import APIRouter, Path
from pydantic import BaseModel

from app.core.response import success
from app.schemas.id_types import IdStr

router = APIRouter(prefix="/families", tags=["families"])


class FamilyCreateRequest(BaseModel):
    name: str
    timezone: str = "Asia/Shanghai"


class FamilyMemberCreateRequest(BaseModel):
    user_id: IdStr | None = None
    invitee_phone: str | None = None
    role: str


class FamilyMemberUpdateRequest(BaseModel):
    role: str | None = None
    status: str | None = None


@router.get("")
def list_families() -> dict:
    return success([
        {"id": "20001", "name": "默认家庭", "role": "owner", "timezone": "Asia/Shanghai"}
    ])


@router.post("")
def create_family(payload: FamilyCreateRequest) -> dict:
    return success({"id": "20002", "name": payload.name, "role": "owner", "timezone": payload.timezone})


@router.post("/{family_id}/members")
def create_family_member(family_id: Annotated[IdStr, Path()], payload: FamilyMemberCreateRequest) -> dict:
    return success(
        {
            "id": "30001",
            "family_id": family_id,
            "user_id": payload.user_id or "0",
            "role": payload.role,
            "status": "pending",
        }
    )


@router.patch("/{family_id}/members/{member_id}")
def update_family_member(
    family_id: Annotated[IdStr, Path()],
    member_id: Annotated[IdStr, Path()],
    payload: FamilyMemberUpdateRequest,
) -> dict:
    return success(
        {
            "id": member_id,
            "family_id": family_id,
            "user_id": "10002",
            "role": payload.role or "caregiver",
            "status": payload.status or "active",
        }
    )
