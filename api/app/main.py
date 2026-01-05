from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.health import router as health_router
from app.api.onboarding import router as onboarding_router
from app.api.profile import router as profile_router
from app.api.study import router as study_router


class UTF8JSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"


def create_app() -> FastAPI:
    app = FastAPI(title="English Web API", version="0.1.0", default_response_class=UTF8JSONResponse)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(auth_router)
    app.include_router(onboarding_router)
    app.include_router(dashboard_router)
    app.include_router(profile_router)
    app.include_router(study_router)
    return app


app = create_app()
