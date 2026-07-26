import os
from typing import Tuple

import joblib
import mlflow
import pandas as pd
from sklearn.base import BaseEstimator
from zenml import step

from centralized_logging.logger import get_logger
from mlflow_tracking.mlflow_utils import setup_mlflow

logger = get_logger(__name__)


@step(enable_cache=False)
def train_model_step(
    model: BaseEstimator,
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> Tuple[BaseEstimator, str]:

    if not pd.api.types.is_numeric_dtype(y_train):
        raise ValueError(
            "y_train must be numeric (label-encoded) before training. "
            "Run the label encoding step first."
        )
    y_train = y_train.astype(int)

    logger.info(f"Training {type(model).__name__} on data of shape {X_train.shape}.")

    setup_mlflow()

    with mlflow.start_run(run_name=f"train_{type(model).__name__}") as run:
        mlflow.log_params(model.get_params())

        model.fit(X_train, y_train)

        mlflow.sklearn.log_model(model, artifact_path="model")

        run_id = run.info.run_id

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "cbc_model.pkl")
    joblib.dump(model, model_path)

    logger.info(f"Model trained and saved to: {model_path}")
    logger.info(f"MLflow run_id: {run_id}")

    return model, run_id

# python -m steps.train_model