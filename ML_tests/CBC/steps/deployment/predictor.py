import numpy as np
import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@step(enable_cache=False)
def predictor(model, df: pd.DataFrame) -> np.ndarray:
    """Runs prediction on already fully-preprocessed data (post feature
    extraction, scaling, power transform, and feature selection)."""
    logger.info(f"Running prediction on input shape: {df.shape}")

    prediction = np.array(model.predict(df))

    logger.info(f"Prediction result: {prediction}")

    return prediction

# python -m steps.deployment.predictor