import logging
import os

import joblib
import pandas as pd
from zenml import step

logger = logging.getLogger(__name__)


@step
def train_model_step(
    model,
    X_train: pd.DataFrame,
    y_train: pd.Series,
):
    y_train = y_train.astype(int)
    model.fit(X_train, y_train)

    os.makedirs("artifacts", exist_ok=True)
    joblib.dump(model, "artifacts/ckd_model.pkl")
    logger.info("Model saved to artifacts/ckd_model.pkl")

    return model