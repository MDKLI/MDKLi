import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, PowerTransformer
from app.ml.model_loader import ModelLoader

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

EPS = 1e-8

SELECTED_FEATURES = [
    'gfr', 'kidney_function_score', 'gfr_bun_ratio', 'cluster',
    'c3_c4', 'inflammation_score', 'urine_ph',
    'diet_high protein', 'alcohol_occasionally', 'hematuria'
]


class InferenceService:
    def __init__(self, model_path: str):
        self.model = ModelLoader(model_path).load_model()
        self._load_preprocessors()
        logger.info("Model and preprocessors loaded successfully")

    def _load_preprocessors(self):
        try:
           self.scaler = joblib.load("artifacts/inference_scaler.pkl")
           self.power_transformer = joblib.load("artifacts/inference_power_transformer.pkl")
           logger.info("Preprocessors loaded from artifacts")
        except Exception:
           logger.warning("Preprocessors not found, fitting from data...")
           self._fit_preprocessors()

    def _fit_preprocessors(self):
        df = pd.read_csv("extracted_data/updated_ckd_dataset_with_stages.csv")
        df = self._compute_features(df)
        df = df[SELECTED_FEATURES]

        self.scaler = StandardScaler()
        df_scaled = pd.DataFrame(
            self.scaler.fit_transform(df),
            columns=SELECTED_FEATURES
        )

        self.power_transformer = PowerTransformer(method="yeo-johnson")
        self.power_transformer.fit(df_scaled)

        joblib.dump(self.scaler, "artifacts/scaler.pkl")
        joblib.dump(self.power_transformer, "artifacts/power_transformer.pkl")
        logger.info("Preprocessors fitted and saved")

    def _compute_features(self, data: dict) -> pd.DataFrame:
        df = pd.DataFrame([data])
        df = df.apply(pd.to_numeric, errors="coerce")
        df = df.replace([np.inf, -np.inf], np.nan)
        df = df.fillna(0)

        df["gfr_bun_ratio"] = df["gfr"] / (df["bun"] + EPS)
        df["c3_c4_norm"] = (
            df["c3_c4"] - df["c3_c4"].min()
        ) / (df["c3_c4"].max() - df["c3_c4"].min() + EPS)
        df["inflammation_score"] = (
            df["ana"].astype(float)
            + df["hematuria"].astype(float)
            + (1 - df["c3_c4_norm"])
        )
        df["kidney_function_score"] = (
            df["gfr"]
            - 0.5 * df["serum_creatinine"]
            - 0.3 * df["bun"]
        )

        return df

    def _encode_categoricals(self, data: dict) -> dict:
        data["diet_high protein"] = 1 if data.get("diet") == "high protein" else 0
        data["alcohol_occasionally"] = 1 if data.get("alcohol") == "occasionally" else 0
        return data

    def _preprocess(self, data: dict) -> pd.DataFrame:
        data = self._encode_categoricals(data)
        df = self._compute_features(data)
        df_selected = df[SELECTED_FEATURES].copy()

        df_scaled = pd.DataFrame(
            self.scaler.transform(df_selected),
            columns=SELECTED_FEATURES
        )

        df_transformed = pd.DataFrame(
            self.power_transformer.transform(df_scaled),
            columns=SELECTED_FEATURES
        )

        return df_transformed

    def predict(self, data: dict) -> int:
        df = self._preprocess(data)
        pred = self.model.predict(df)[0]
        return int(pred)

    def predict_with_proba(self, data: dict) -> float:
        df = self._preprocess(data)
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(df)[0].max()
            return float(proba)
        return None