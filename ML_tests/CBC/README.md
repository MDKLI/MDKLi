# CBC Prediction API

Hierarchical CBC (Complete Blood Count) prediction API built with FastAPI.
Part of the MDKLi graduation project.

## Requirements

- Python 3.12+ (or the project's supported version)
- Docker & Docker Compose
- Make
- Git

## Setup

Only the `ML_tests/CBC` folder is needed to run the API — you don't need
the rest of the `MDKLi` repo. The project also lives on the `ML_tests`
branch, not `main`. Use a sparse checkout to pull just this folder:

```bash
git clone --no-checkout --filter=blob:none https://github.com/MDKLI/MDKLi.git
cd MDKLi

git sparse-checkout init --cone
git sparse-checkout set ML_tests/CBC
git checkout ML_tests

cd ML_tests/CBC
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
- **`mlflow`** — the MLflow tracking server, on `http://localhost:5005`

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

## To Test

**`POST /v1/predict/from-report`** — upload a lab report image/PDF:

<img width="761" height="533" alt="Screenshot From 2026-07-15 04-55-31" src="https://github.com/user-attachments/assets/f1270970-eb4f-4bf9-8db4-75e9db5cc6a3" />

**`POST /v1/predict/from-values`** — send raw lab values as JSON:

```json
{
    "WBC": 7.4,
    "RBC": 5.27,
    "HGB": 13.9,
    "HCT": 43.8,
    "MCV": 88.6,
    "MCH": 29.4,
    "MCHC": 33.4,
    "PLT": 248,
    "PDW": 12.1,
    "PCT": 0.25,
    "LYMp": 32.0,
    "NEUTp": 62.0,
    "LYMn": 2.4,
    "NEUTn": 4.6
}
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
