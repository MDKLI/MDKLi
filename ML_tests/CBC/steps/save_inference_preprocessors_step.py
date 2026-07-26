import json
import os
from typing import Dict, List

import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@step(enable_cache=False)
def save_inference_preprocessors_step(
    scaler_path: str,
    transformer_path: str,
    selected_features: List[str],
    numeric_columns: List[str],
    manifest_path: str = "artifacts/inference_manifest.json",
) -> str:

    for path, label in [(scaler_path, "scaler"), (transformer_path, "power transformer")]:
        if not path or not os.path.exists(path):
            raise FileNotFoundError(f"Expected {label} artifact not found at: {path}")

    manifest: Dict = {
        "scaler_path": scaler_path,
        "transformer_path": transformer_path,
        "selected_features": selected_features,
        "numeric_columns": numeric_columns,
    }

    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    logger.info(f"Inference preprocessing manifest saved to: {manifest_path}")
    logger.info(f"Selected features: {selected_features}")

    return manifest_path


# python -m steps.save_inference_preprocessors_step