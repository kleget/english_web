from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    interface_lang: str


class LoginRequest(BaseModel):
    email: str
    password: str
    interface_lang: str | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    interface_lang: str | None = None
    theme: str | None = None
    native_lang: str | None = None
    target_lang: str | None = None
    onboarding_done: bool | None = None
