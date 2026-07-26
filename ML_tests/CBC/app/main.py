from contextlib import asynccontextmanager

from fastapi import FastAPI

from centralized_logging.logger import get_logger
from config.logging_config import configure_root_log_level
from app.dependencies import get_loaded_model
from app.middleware.logging_middleware import RequestLoggingMiddleware
from app.v1.routes import health, predict

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_root_log_level()
    logger.info("CBC Diagnosis API starting up...")

    try:
        get_loaded_model()
        logger.info("Model preloaded successfully.")
    except Exception as e:
        logger.warning(
            f"Model could not be preloaded at startup: {e}. "
            "The /health endpoint will report 'degraded' until this is resolved."
        )

    yield

    logger.info("CBC Diagnosis API shutting down...")


app = FastAPI(
    title="CBC Diagnosis API",
    description="Extracts CBC values from a lab report image/PDF via a "
                "Vision LLM (Claude) and predicts a diagnosis using the "
                "trained CBC model.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(RequestLoggingMiddleware)

app.include_router(health.router, prefix="/v1", tags=["health"])
app.include_router(predict.router, prefix="/v1", tags=["predict"])

# uvicorn app.main:app --reload --port 8000
# http://127.0.0.1:8000/docs