from pydantic import BaseModel


class WechatLoginRequest(BaseModel):
    code: str
    encrypted_phone_data: str | None = None
    iv: str | None = None
