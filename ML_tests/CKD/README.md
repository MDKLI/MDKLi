# CKD Prediction ML Pipeline

A full MLOps pipeline for predicting Chronic Kidney Disease (CKD) stages using ZenML, MLflow, FastAPI, and Docker.

## Project Structure



CKD/

├── src/                    # Core logic (strategies, models, evaluators)

├── steps/                  # ZenML pipeline steps

├── pipelines/              # ZenML pipelines

├── scripts/                # Run scripts

├── app/                    # FastAPI inference API

├── docker/                 # Docker & docker-compose

├── CI-CD/                  # GitHub Actions workflow

└── analysis/               # EDA notebooks




## Pipeline Steps

1. Data Ingestion
2. Feature Engineering (One-Hot Encoding)
3. Feature Extraction (CKD-specific features)
4. Scaling (Standard Scaler)
5. Power Transform (Yeo-Johnson)
6. Outlier Detection (Z-score)
7. Train/Test Split
8. Feature Selection (Mutual Information)
9. Model Building (Random Forest)
10. Model Training
11. Model Evaluation

## Model Performance

- **Accuracy:** 99.12%
- **F1 Score:** 99.12%
- **Target:** CKD Stage (0-5)

## Features Used

| Feature | Description |
|---|---|
| gfr | Glomerular Filtration Rate |
| kidney_function_score | Composite kidney function score |
| gfr_bun_ratio | GFR to BUN ratio |
| cluster | Patient cluster |
| urine_ph | Urine pH level |
| inflammation_score | Inflammation composite score |
| c3_c4 | Complement levels |
| c3_c4_norm | Normalized complement levels |
| bun | Blood Urea Nitrogen |
| ana | Antinuclear Antibodies |

## Run Training Pipeline

```bash
python -m scripts.run_pipeline
```

## Run Deployment Pipeline

```bash
python -m scripts.run_deployment
```

## Run Inference Only

```bash
python -m scripts.run_deployment --infer-only
```

## Run API Locally

```bash
uvicorn app.main:app --reload
```

API docs available at: `http://localhost:8000/docs`

## Run with Docker

```bash
docker-compose -f docker/docker-compose.yml up --build
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/predict` | POST | Predict CKD stage |

### Example Request

```json
{
  "gfr": -0.176036,
  "kidney_function_score": 0.002904,
  "gfr_bun_ratio": 0.158833,
  "cluster": 0.734180,
  "urine_ph": -0.370931,
  "inflammation_score": -0.720636,
  "c3_c4": 0.704711,
  "c3_c4_norm": 0.704711,
  "bun": -0.351793,
  "ana": -0.654654
}
```

### Example Response

```json
{
  "ckd_stage": 0,
  "probability": 1.0
}
```

## Tech Stack

- **Pipeline:** ZenML
- **Experiment Tracking:** MLflow
- **Model:** Random Forest (scikit-learn)
- **API:** FastAPI
- **Containerization:** Docker
- **CI/CD:** GitHub Actions