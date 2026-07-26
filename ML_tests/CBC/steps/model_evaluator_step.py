from typing import Any, Dict, Union

import mlflow
import pandas as pd
from sklearn.base import BaseEstimator
from zenml import step

from centralized_logging.logger import get_logger
from mlflow_tracking.mlflow_utils import setup_mlflow, log_metrics_safe, log_per_class_metrics
from src.model_evaluator import ModelEvaluator, ClassificationEvaluationStrategy

logger = get_logger(__name__)


@step(enable_cache=False)
def evaluate_model_step(
    model: BaseEstimator,
    X_test: pd.DataFrame,
    y_test: Union[pd.Series, Any],
    run_id: str,
) -> Dict[str, Any]:

    logger.info("Evaluation Step Started")

    if model is None:
        raise ValueError("Model is None")

    if X_test is None or y_test is None:
        raise ValueError("X_test or y_test is None")

    evaluator = ModelEvaluator(strategy=ClassificationEvaluationStrategy())
    results = evaluator.evaluate_model(model, X_test, y_test)

    accuracy = results.get("accuracy")
    f1 = results.get("f1_score")

    accuracy_str = f"{accuracy:.4f}" if accuracy is not None else "N/A"
    f1_str = f"{f1:.4f}" if f1 is not None else "N/A"

    logger.info("Evaluation Completed Successfully")
    logger.info(f"Metrics -> Accuracy: {accuracy_str}, F1: {f1_str}")

    setup_mlflow()

    with mlflow.start_run(run_id=run_id):
        log_metrics_safe({"accuracy": accuracy, "f1_score": f1})
        log_per_class_metrics(results.get("per_class_metrics", {}))

    return results

# python -m steps.model_evaluator_step