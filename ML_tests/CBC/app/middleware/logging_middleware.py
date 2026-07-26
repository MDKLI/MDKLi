import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        logger.info(
            f"{request.method} {request.url.path} -> {response.status_code} "
            f"({duration_ms:.1f}ms)"
        )

        return response