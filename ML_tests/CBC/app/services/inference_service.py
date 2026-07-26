from typing import Dict, List, Tuple

import pandas as pd

from centralized_logging.logger import get_logger
from app.ml.model_loader import LoadedModel
from src.feature_extraction import FeatureExtractor, CBCFeatureExtractionStrategy

logger = get_logger(__name__)


class InferenceService:
    """Runs the exact feature_extraction -> scaling -> power_transform ->
    feature_selection -> predict path used during training (and in
    scripts/sample_predictor.py) against a single raw CBC reading.

    Does not fit anything - only applies the scaler/transformer/feature
    list already fitted during training, loaded via LoadedModel.
    """

    def __init__(self, loaded_model: LoadedModel):
        self._loaded_model = loaded_model
        self._extractor = FeatureExtractor(strategy=CBCFeatureExtractionStrategy())

    def predict(self, raw_values: Dict[str, float]) -> Tuple[str, List[str]]:
        warnings: List[str] = []

        df_raw = pd.DataFrame([raw_values])
        df_extracted = self._extractor.apply_feature_extraction(df_raw)

        if df_extracted.empty:
            raise ValueError(
                "One or more submitted CBC values fall outside the "
                "physiological range used during training (see "
                "src.feature_extraction.CBCFeatureExtractionStrategy."
                "PHYSIOLOGICAL_RANGES). Please verify the reading before retrying."
            )

        numeric_cols = self._loaded_model.numeric_columns
        missing_numeric = [c for c in numeric_cols if c not in df_extracted.columns]
        if missing_numeric:
            raise ValueError(
                f"Extracted features are missing columns the scaler/transformer "
                f"were fit on: {missing_numeric}"
            )

        df_extracted[numeric_cols] = self._loaded_model.scaler.transform(df_extracted[numeric_cols])
        df_extracted[numeric_cols] = self._loaded_model.transformer.transform(df_extracted[numeric_cols])

        selected_features = self._loaded_model.selected_features
        missing_selected = [c for c in selected_features if c not in df_extracted.columns]
        if missing_selected:
            raise ValueError(f"Preprocessed data is missing required columns: {missing_selected}")

        df_final = df_extracted[selected_features]

        prediction = self._loaded_model.model.predict(df_final)
        diagnosis = str(prediction[0])

        logger.info(f"Prediction: {diagnosis}")

        return diagnosis, warnings