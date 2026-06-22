import logging
from typing import Any, Dict

import pandas as pd
from zenml import step

from src.model_evaluator import (
    ModelEvaluator,
    ClassificationEvaluationStrategy
)

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


@step
def evaluate_model_step(
    model: Any,
    X_test: Any,
    y_test: Any
) -> Dict[str, Any]:

    logger.info("Evaluation Step Started")

    if model is None:
        raise ValueError("Model is None")

    if X_test is None or y_test is None:
        raise ValueError("X_test or y_test is None")

    if isinstance(y_test, pd.Series):
        y_test = y_test.astype(int)

    evaluator = ModelEvaluator(
        strategy=ClassificationEvaluationStrategy()
    )

    results = evaluator.evaluate_model(model, X_test, y_test)

    logger.info("Evaluation Completed Successfully")

    logger.info(
        f"Metrics -> "
        f"Accuracy: {results.get('accuracy'):.4f}, "
        f"F1: {results.get('f1_score'):.4f}"
    )

    return results