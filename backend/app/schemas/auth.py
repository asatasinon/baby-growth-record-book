from typing import Annotated

from pydantic import BaseModel, Field

PhoneStr = Annotated[str, Field(pattern=r"^1\d{10}$")]


class WechatLoginRequest(BaseModel):
    code: str = Field(min_length=1, max_length=128)
    phone: PhoneStr | None = None
    encrypted_phone_data: str | None = None
    iv: str | None = None


class PasswordLoginRequest(BaseModel):
    phone: PhoneStr
    password: str = Field(min_length=8, max_length=128)
