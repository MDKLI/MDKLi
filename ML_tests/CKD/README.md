# CKD Prediction ML Pipeline

A full MLOps pipeline for predicting Chronic Kidney Disease (CKD) stages using ZenML, MLflow, FastAPI, and Docker.

---

## Project Structure

```
CKD/
│
├── extracted_data/                         # (1.0) Raw dataset
│   └── updated_ckd_dataset_with_stages.csv
│
├── analysis/                               # (2.0) Exploratory Data Analysis
│   ├── analyze_src/
│   │   ├── basic_data_inspection.py        # (2.1) Basic inspection
│   │   ├── missing_values_analysis.py      # (2.2) Missing values
│   │   ├── univariate_analysis.py          # (2.3) Univariate analysis
│   │   ├── bivariate_analysis.py           # (2.4) Bivariate analysis
│   │   └── multivariate_analysis.py        # (2.5) Multivariate analysis
│   └── EDA.ipynb                           # (2.6) Full EDA notebook
│
├── src/                                    # (3.x.1) Core logic (strategies & engines)
│   ├── ingest_data.py                      # (3.1.1) Data ingestion
│   ├── outlier_detection.py                # (3.3.1) Outlier detection
│   ├── feature_engineering.py             # (3.4.1) Feature engineering
│   ├── feature_extraction.py              # (3.5.1) Feature extraction
│   ├── scaling.py                          # (3.6.1) Scaling
│   ├── power_transform.py                  # (3.7.1) Power transformation
│   ├── mutual_information.py              # (3.8.1) Feature selection
│   ├── data_splitter.py                    # (3.9.1) Data splitting
│   ├── model_building.py                   # (3.10.1) Model building
│   └── model_evaluator.py                  # (3.11.1) Model evaluation
│
├── steps/                                  # (3.x.2) ZenML pipeline steps
│   ├── data_ingestion_step.py              # (3.1.2)
│   ├── outlier_detection_step.py          # (3.3.2)
│   ├── feature_engineering_step.py        # (3.4.2)
│   ├── feature_extraction_step.py         # (3.5.2)
│   ├── scaling_step.py                     # (3.6.2)
│   ├── power_transform_step.py            # (3.7.2)
│   ├── mutual_information_step.py         # (3.8.2)
│   ├── data_splitter_step.py              # (3.9.2)
│   ├── model_building_step.py             # (3.10.2)
│   ├── train_model.py                      # (3.10.3)
│   ├── model_evaluator_step.py            # (3.11.2)
│   ├── save_inference_preprocessors_step.py # (3.12.0)
│   └── deployment/                         # (3.12.x) Deployment steps
│       ├── dynamic_importer.py             # (3.12.1)
│       ├── prediction_service_loader.py    # (3.12.2)
│       ├── model_loader.py                 # (3.12.3)
│       └── predictor.py                    # (3.12.4)
│
├── pipelines/                              # (4.0) ZenML pipelines
│   ├── training_pipeline.py               # (4.1)
│   └── deployment_pipeline.py             # (4.2)
│
├── scripts/                               # (5.0) Run scripts
│   ├── run_pipeline.py                    # (5.1)
│   ├── run_deployment.py                  # (5.2)
│   └── sample_predictor.py               # (5.3)
│
├── app/                                   # (6.0) FastAPI Inference API
│   ├── main.py
│   ├── schemas.py
│   ├── ml/
│   │   └── model_loader.py
│   └── services/
│       └── inference_service.py
│
├── docker/                                # (7.0) Containerization
│   ├── dockerfile
│   └── docker-compose.yml
│
├── CI-CD/                                 # (8.0) GitHub Actions
│   └── .github/workflows/
│       └── ml-ci-cd.yml
│
├── artifacts/                             # (9.0) Saved artifacts
│   ├── ckd_model.pkl
│   ├── inference_scaler.pkl
│   ├── inference_power_transformer.pkl
│   └── mi_selection/
│       └── mi_scores.png
│
└── requirements.txt
```

---

## Training Pipeline

```
Data Ingestion
→ Feature Engineering   (OneHotEncoding on categorical columns)
→ Feature Extraction    (CKD-specific domain features)
→ Train / Test Split    (Stratified 80/20)
→ Outlier Detection     (Z-score on train only)
→ Scaling               (StandardScaler fit on train, transform both)
→ Power Transform       (Yeo-Johnson fit on train, transform both)
→ MI Feature Selection  (top 10 features on train)
→ Save Inference Preprocessors
→ Filter Test Features
→ Model Training        (Random Forest)
→ Model Evaluation
```

---

## Selected Features (top 10 by Mutual Information)

| Feature | Description |
|---|---|
| gfr | Glomerular Filtration Rate |
| kidney_function_score | Composite kidney score (GFR - 0.5×Creatinine - 0.3×BUN) |
| gfr_bun_ratio | GFR to BUN ratio |
| cluster | Patient cluster group |
| c3_c4 | Complement protein levels |
| inflammation_score | ANA + Hematuria + (1 - C3C4 normalized) |
| urine_ph | Urine pH level |
| diet_high protein | High protein diet (encoded) |
| alcohol_occasionally | Occasional alcohol use (encoded) |
| hematuria | Blood in urine |

---

## Model Performance

| Metric | Score |
|---|---|
| Accuracy | 98.88% |
| F1 Score (weighted) | 98.89% |
| Target Classes | CKD Stage 0 to 5 |

---

## API Input (Raw Clinical Values)

```json
{
  "gfr": 32.9,
  "serum_creatinine": 0.68,
  "bun": 7.5,
  "serum_calcium": 10.0,
  "urine_ph": 7.86,
  "c3_c4": 138.2,
  "ana": 0,
  "hematuria": 0,
  "cluster": 5,
  "oxalate_levels": 5.0,
  "diet": "high protein",
  "alcohol": "occasionally"
}
```

## API Output

```json
{
  "ckd_stage": 0,
  "probability": 0.98
}
```

---

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

API docs: `http://localhost:8000/docs`

## Run with Docker

```bash
docker-compose -f docker/docker-compose.yml up --build
```

---

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Health check |
| `/predict` | POST | Predict CKD stage from raw clinical values |

---

## Tech Stack

| Component | Technology |
|---|---|
| Pipeline Orchestration | ZenML |
| Experiment Tracking | MLflow |
| Model | Random Forest (scikit-learn) |
| API | FastAPI |
| Containerization | Docker |
| CI/CD | GitHub Actions |
