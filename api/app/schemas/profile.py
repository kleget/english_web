from pydantic import BaseModel


class ProfileOut(BaseModel):
    interface_lang: str
    theme: str


class ProfileUpdateRequest(BaseModel):
    interface_lang: str | None = None
    theme: str | None = None
