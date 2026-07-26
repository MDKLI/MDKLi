import json

import joblib
import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@step(enable_cache=False)
def apply_inference_preprocessing_step(
    df: pd.DataFrame,
    manifest_path: str = "artifacts/inference_manifest.json",
) -> pd.DataFrame:

    with open(manifest_path) as f:
        manifest = json.load(f)

    required_keys = {"scaler_path", "transformer_path", "selected_features", "numeric_columns"}
    missing_keys = required_keys - set(manifest.keys())
    if missing_keys:
        raise ValueError(
            f"Manifest at '{manifest_path}' is missing keys: {missing_keys}. "
            "Re-run the training pipeline to regenerate it with the current schema."
        )

    scaler = joblib.load(manifest["scaler_path"])
    transformer = joblib.load(manifest["transformer_path"])
    selected_features = manifest["selected_features"]
    numeric_cols = manifest["numeric_columns"]

    missing = [c for c in numeric_cols if c not in df.columns]
    if missing:
        raise ValueError(
            f"Input data is missing columns the scaler/transformer were fit on: {missing}"
        )

    df = df.copy()
    df[numeric_cols] = scaler.transform(df[numeric_cols])
    df[numeric_cols] = transformer.transform(df[numeric_cols])

    missing_selected = [c for c in selected_features if c not in df.columns]
    if missing_selected:
        raise ValueError(f"Input data is missing required columns: {missing_selected}")

    df_final = df[selected_features]

    logger.info(f"Applied inference preprocessing. Output shape: {df_final.shape}")

    return df_final

# python -m steps.deployment.apply_inference_preprocessing_step