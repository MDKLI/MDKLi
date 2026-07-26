import os

import joblib
from zenml import step

from centralized_logging.logger import get_logger

logger = get_logger(__name__)

MODEL_PATHS = {
    "standard": "artifacts/cbc_model.pkl",
    "hierarchical": "artifacts/cbc_hierarchical_model.pkl",
}


@step(enable_cache=False)
def model_loader(model_name: str, model_mode: str = "hierarchical"):

    if model_mode not in MODEL_PATHS:
        raise ValueError(f"Unsupported model_mode: {model_mode}")

    model_path = MODEL_PATHS[model_mode]

    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model artifact not found at '{model_path}'. "
            f"Ensure the training pipeline ran with model_mode='{model_mode}'."
        )

    try:
        model = joblib.load(model_path)
        logger.info(f"Model '{model_name}' ({model_mode}) loaded successfully from {model_path}")
        return model
    except Exception as e:
        logger.error(f"Failed to load model '{model_name}': {e}")
        raise RuntimeError(f"Failed to load model '{model_name}': {e}") from e

# python -m steps.deployment.model_loader