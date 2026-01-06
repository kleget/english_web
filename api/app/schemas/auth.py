from pydantic import BaseModel


class RegisterRequest(BaseModel):
    email: str
    password: str
    interface_lang: str


class LoginRequest(BaseModel):
    email: str
    password: str
    interface_lang: str | None = None


class EmailRequest(BaseModel):
    email: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class TokenOut(BaseModel):
    access_token: str
    email_verified: bool = True
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    email: str
    interface_lang: str | None = None
    theme: str | None = None
    email_verified: bool | None = None
    is_admin: bool | None = None
    native_lang: str | None = None
    target_lang: str | None = None
    onboarding_done: bool | None = None
