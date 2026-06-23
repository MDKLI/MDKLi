import logging
from typing import Literal, Union

from zenml import step

from src.model_building import (
    ModelBuilder,
    LogisticRegressionStrategy,
    RandomForestStrategy
)

# ===================== LOGGER =====================
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# ===================== STEP =====================
@step
def build_model_step(
    model_type: Literal["logreg", "rf"] = "logreg",
    rf_estimators: int = 100,
    rf_max_depth: int = None,
    logreg_max_iter: int = 1000,
    logreg_C: float = 1.0
):
    """
    ZenML Model Building Step
    """

    logger.info(f"Build Model Step Started with model_type={model_type}")

    # ===================== MODEL SELECTION =====================
    if model_type == "logreg":
        logger.info("Initializing Logistic Regression Strategy")

        strategy = LogisticRegressionStrategy(
            max_iter=logreg_max_iter,
            C=logreg_C
        )

    elif model_type == "rf":
        logger.info("Initializing Random Forest Strategy")

        strategy = RandomForestStrategy(
            n_estimators=rf_estimators,
            max_depth=rf_max_depth
        )

    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    # ===================== BUILD MODEL =====================
    builder = ModelBuilder(strategy)
    model = builder.build_model()

    logger.info(f"Model Built Successfully: {type(model).__name__}")

    return model