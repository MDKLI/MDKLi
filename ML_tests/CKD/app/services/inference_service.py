import logging
import pandas as pd
from app.ml.model_loader import ModelLoader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


class InferenceService:
    def __init__(self, model_path: str):
        self.model = ModelLoader(model_path).load_model()

    def predict(self, data: dict) -> int:
        df = pd.DataFrame([data])
        pred = self.model.predict(df)[0]
        return int(pred)

    def predict_with_proba(self, data: dict) -> float:
        df = pd.DataFrame([data])
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(df)[0].max()
            return float(proba)
        return None