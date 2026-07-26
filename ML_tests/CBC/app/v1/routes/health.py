from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.dependencies import get_loaded_model
from app.schemas import HealthResponse
from config.settings import get_settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check() -> JSONResponse:
    settings = get_settings()

    try:
        get_loaded_model()
        model_loaded = True
    except Exception:
        model_loaded = False

    body = HealthResponse(
        status="ok" if model_loaded else "degraded",
        model_mode=settings.model_mode,
        model_loaded=model_loaded,
    )
    # 200 when the local model/artifacts are loaded, 503 otherwise - this is
    # what lets Kubernetes readiness/liveness probes (or Docker healthchecks)
    # actually detect trouble and act on it, instead of always seeing "OK".
    status_code = 200 if model_loaded else 503
    return JSONResponse(status_code=status_code, content=body.model_dump())
