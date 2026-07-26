from typing import Literal, Optional

from sklearn.base import BaseEstimator
from zenml import step

from centralized_logging.logger import get_logger
from src.model_building import (
    ModelBuilder,
    LogisticRegressionStrategy,
    RandomForestStrategy,
    XGBoostStrategy,
)

logger = get_logger(__name__)


@step(enable_cache=False)
def build_model_step(
    model_type: Literal["logreg", "rf", "xgboost"] = "logreg",
    rf_estimators: int = 100,
    rf_max_depth: Optional[int] = None,
    logreg_max_iter: int = 1000,
    logreg_C: float = 1.0,
    xgb_estimators: int = 100,
    xgb_max_depth: int = 3,
    xgb_learning_rate: float = 0.1,
) -> BaseEstimator:

    logger.info(f"Build Model Step Started with model_type={model_type}")

    if model_type == "logreg":
        logger.info("Initializing Logistic Regression Strategy")
        strategy = LogisticRegressionStrategy(
            max_iter=logreg_max_iter,
            C=logreg_C,
        )

    elif model_type == "rf":
        logger.info("Initializing Random Forest Strategy")
        strategy = RandomForestStrategy(
            n_estimators=rf_estimators,
            max_depth=rf_max_depth,
        )

    elif model_type == "xgboost":
        logger.info("Initializing XGBoost Strategy")
        strategy = XGBoostStrategy(
            n_estimators=xgb_estimators,
            max_depth=xgb_max_depth,
            learning_rate=xgb_learning_rate,
        )

    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    builder = ModelBuilder(strategy)
    model = builder.build_model()

    logger.info(f"Model Built Successfully: {type(model).__name__}")

    return model

# python -m steps.model_building_step