FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    UV_HTTP_TIMEOUT=300 \
    UV_HTTP_CONNECT_TIMEOUT=60 \
    UV_HTTP_RETRIES=5 \
    UV_LINK_MODE=copy

RUN apt-get update && apt-get install -y \
    build-essential \
    g++ \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY uv.lock pyproject.toml README.md /app/

RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

COPY src/ /app/

ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install -e .

VOLUME ["/app/data"]

EXPOSE 8000 8080

# Run the FastAPI app using uvicorn
CMD ["/app/.venv/bin/fastapi", "run", "ai_companion/interfaces/whatsapp/webhook_endpoint.py", "--port", "8080", "--host", "0.0.0.0"]
