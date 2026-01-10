import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.admin_content import router as admin_content_router
from app.api.custom_words import router as custom_words_router
from app.api.dashboard import router as dashboard_router
from app.api.health import router as health_router
from app.api.onboarding import router as onboarding_router
from app.api.profile import router as profile_router
from app.api.reports import router as reports_router
from app.api.social import router as social_router
from app.api.stats import router as stats_router
from app.api.study import router as study_router
from app.api.tech import router as tech_router
from app.api.support import router as support_router
from app.core.audit import log_audit_event
from app.core.security import decode_access_token


class UTF8JSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"


def create_app() -> FastAPI:
    app = FastAPI(title="Recallio API", version="0.1.0", default_response_class=UTF8JSONResponse)
    @app.middleware("http")
    async def audit_middleware(request: Request, call_next):
        user_id = None
        auth_header = request.headers.get("authorization") or ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            if token:
                try:
                    subject = decode_access_token(token)
                    user_id = uuid.UUID(subject)
                except Exception:
                    user_id = None

        try:
            response = await call_next(request)
        except Exception as exc:
            await log_audit_event(
                "error",
                user_id=user_id,
                status="error",
                meta={"path": request.url.path, "method": request.method, "detail": str(exc)},
                request=request,
            )
            raise

        if response.status_code >= 500:
            await log_audit_event(
                "error",
                user_id=user_id,
                status="error",
                meta={
                    "path": request.url.path,
                    "method": request.method,
                    "status_code": response.status_code,
                },
                request=request,
            )
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(admin_router)
    app.include_router(admin_content_router)
    app.include_router(onboarding_router)
    app.include_router(dashboard_router)
    app.include_router(custom_words_router)
    app.include_router(profile_router)
    app.include_router(social_router)
    app.include_router(stats_router)
    app.include_router(study_router)
    app.include_router(tech_router)
    app.include_router(reports_router)
    app.include_router(support_router)
    return app


app = create_app()
