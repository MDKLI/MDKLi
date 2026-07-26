# CBC Prediction API

Hierarchical CBC (Complete Blood Count) prediction API built with FastAPI.
Part of the MDKLi graduation project.

## Requirements

- Python 3.12+ (or the project's supported version)
- Docker & Docker Compose
- Make
- Git

## Setup

Save this as `docker/docker-compose.yml`:

*(this only builds correctly from inside the project — it needs the
`Dockerfile`, `Dockerfile.mlflow`, `requirements/`, and `app/` source next
to it via `context: ..`; it's not a standalone file like a prebuilt-image
compose setup)*

```yaml
services:
  mlflow:
    build:
      context: ..
      dockerfile: docker/Dockerfile.mlflow
    ports:
      - "5005:5000"
    volumes:
      - mlflow_data:/mlflow_data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: ["api"]
    ports:
      - "8000:8000"
    env_file:
      - ../.env
    environment:
      MLFLOW_TRACKING_URI: http://mlflow:5000
    volumes:
      - artifacts_data:/app/artifacts
    depends_on:
      mlflow:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/v1/health')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s

  trainer:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    command: ["train", "--model-mode", "hierarchical"]
    env_file:
      - ../.env
    environment:
      MLFLOW_TRACKING_URI: http://mlflow:5000
    volumes:
      - artifacts_data:/app/artifacts
    depends_on:
      mlflow:
        condition: service_healthy
    profiles:
      - tools

volumes:
  artifacts_data:
  mlflow_data:
```

`.env` is not tracked in git (it's in `.gitignore`, and there's no
`.env.example` in the repo either), so create it yourself:

```bash
touch .env
nano .env
```

Add at minimum:

```
GEMINI_API_KEY=your-actual-key-here
```

Check `config/settings.py` for any other variables it reads from `.env`
and add those too if needed.

The trained model artifacts (`artifacts/cbc_hierarchical_model.pkl`,
`scaler.joblib`, `label_encoders.joblib`, etc.) are already included in the
repo, so no training or model-building step is needed to run the API.

## Run with Docker

```bash
docker compose -f docker/docker-compose.yml up --build
```

This starts two services:

- **`api`** — the FastAPI app, on `http://localhost:8000`
- **`mlflow`** — the MLflow tracking server, on `http://localhost:5002`

(there's also a `trainer` service in the compose file, but it's behind the
`tools` profile and won't start with a plain `up` — see
[DEVELOPMENT.md](DEVELOPMENT.md) if you need it)

The API will be available at:

```
http://localhost:8000
```

Swagger UI:

```
http://localhost:8000/docs
```

Health check:

```
GET /v1/health
```

## Tests

```bash
make test              # everything
make test-unit         # fast, no artifacts/model required
make test-integration  # needs a trained model present under artifacts/
```

## Developer Notes

If you need to **retrain the model, modify the data, or work with the
ZenML/DVC pipeline**, see [DEVELOPMENT.md](DEVELOPMENT.md). None of that is
required just to run the API.