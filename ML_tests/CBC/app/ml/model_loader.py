import json
import os
from dataclasses import dataclass
from typing import Any, Dict, List

import joblib

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@dataclass
class LoadedModel:
    model: Any
    scaler: Any
    transformer: Any
    numeric_columns: List[str]
    selected_features: List[str]


def _load_manifest(manifest_path: str) -> Dict:
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(
            f"Inference manifest not found at '{manifest_path}'. Run the "
            "training pipeline first to generate it."
        )

    with open(manifest_path) as f:
        manifest = json.load(f)

    required_keys = {"scaler_path", "transformer_path", "selected_features", "numeric_columns"}
    missing_keys = required_keys - set(manifest.keys())
    if missing_keys:
        raise ValueError(
            f"Manifest at '{manifest_path}' is missing keys: {missing_keys}. "
            "Re-run the training pipeline to regenerate it with the current schema."
        )

    return manifest


def load_model_and_manifest(model_path: str, manifest_path: str) -> LoadedModel:
    """Loads the trained model plus its fitted scaler/transformer and the
    exact feature lists recorded at training time. Mirrors the logic in
    steps/deployment/model_loader.py and scripts/sample_predictor.py, but
    as a plain function for use inside the FastAPI process (no ZenML)."""
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model artifact not found at '{model_path}'.")

    manifest = _load_manifest(manifest_path)

    model = joblib.load(model_path)
    scaler = joblib.load(manifest["scaler_path"])
    transformer = joblib.load(manifest["transformer_path"])

    logger.info(f"Loaded model from '{model_path}' and manifest from '{manifest_path}'.")

    return LoadedModel(
        model=model,
        scaler=scaler,
        transformer=transformer,
        numeric_columns=manifest["numeric_columns"],
        selected_features=manifest["selected_features"],
    )