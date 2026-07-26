import os
from typing import Tuple

import joblib
import mlflow
import pandas as pd
from sklearn.base import BaseEstimator
from zenml import step

from centralized_logging.logger import get_logger
from mlflow_tracking.mlflow_utils import setup_mlflow
from src.hierarchical_classifier import HierarchicalClassifier
from src.label_grouper import make_stage1_labels, make_stage2_labels

logger = get_logger(__name__)


class _HierarchicalPyfuncWrapper(mlflow.pyfunc.PythonModel):
    """Wraps HierarchicalClassifier for MLflow serving, since it isn't a
    standard sklearn estimator (custom fit signature, no single .fit(X, y))."""

    def __init__(self, model: HierarchicalClassifier):
        self.model = model

    def predict(self, context, model_input: pd.DataFrame) -> list:
        return self.model.predict(model_input)


@step(enable_cache=False)
def train_hierarchical_model_step(
    stage1_model: BaseEstimator,
    stage2_model: BaseEstimator,
    X_train: pd.DataFrame,
    y_train: pd.Series,
) -> Tuple[HierarchicalClassifier, str]:

    if pd.api.types.is_numeric_dtype(y_train):
        raise ValueError(
            "y_train must contain original string diagnosis labels for "
            "hierarchical training, not label-encoded integers. Skip target "
            "label encoding upstream when using HierarchicalClassifier."
        )

    logger.info(f"Training HierarchicalClassifier on data of shape {X_train.shape}.")

    y_stage1 = make_stage1_labels(y_train)
    y_stage2, rare_mask = make_stage2_labels(y_train)
    X_rare = X_train[rare_mask]

    if X_rare.empty:
        raise ValueError(
            "No rare-class samples found in y_train; check RARE_CLASSES in "
            "label_grouper.py against the actual diagnosis labels present."
        )

    logger.info(
        f"Stage 1 classes: {sorted(y_stage1.unique())} | "
        f"Stage 2 (rare) samples: {X_rare.shape[0]}"
    )

    model = HierarchicalClassifier(stage1_model=stage1_model, stage2_model=stage2_model)

    setup_mlflow()

    with mlflow.start_run(run_name="train_hierarchical_model") as run:
        mlflow.log_param("stage1_model", type(stage1_model).__name__)
        mlflow.log_param("stage2_model", type(stage2_model).__name__)
        mlflow.log_param("n_rare_samples", int(X_rare.shape[0]))

        model.fit(X_train, y_stage1, X_rare, y_stage2)

        mlflow.pyfunc.log_model(
            artifact_path="model",
            python_model=_HierarchicalPyfuncWrapper(model),
        )

        run_id = run.info.run_id

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    model_path = os.path.join(artifacts_dir, "cbc_hierarchical_model.pkl")
    joblib.dump(model, model_path)

    logger.info(f"Hierarchical model trained and saved to: {model_path}")
    logger.info(f"MLflow run_id: {run_id}")

    return model, run_id

# python -m steps.train_hierarchical_model_step