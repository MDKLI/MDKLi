import logging
from fastapi import FastAPI
from app.schemas import CKDInput, CKDPredictionResponse
from app.services.inference_service import InferenceService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

MODEL_PATH = "artifacts/ckd_model.pkl"

app = FastAPI(title="CKD Prediction API", version="1.0")

service = InferenceService(MODEL_PATH)


@app.get("/")
def health():
    return {"status": "CKD API is running"}


@app.post("/predict", response_model=CKDPredictionResponse)
def predict(input_data: CKDInput):
    logger.info("Prediction request received")
    data = input_data.dict()
    pred = service.predict(data)
    proba = service.predict_with_proba(data)
    return CKDPredictionResponse(ckd_stage=pred, probability=proba)




# uvicorn app.main:app --reload