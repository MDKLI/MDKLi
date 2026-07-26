from typing import Optional

from zenml import step

from centralized_logging.logger import get_logger
from mlflow_tracking.mlflow_utils import setup_mlflow
from mlflow_tracking.register_model import register_and_promote_model

logger = get_logger(__name__)


@step(enable_cache=False)
def register_model_step(
    run_id: str,
    model_name: str = "CBC Prediction Model",
    metric_name: str = "f1_score",
    metric_threshold: float = 0.75,
    target_alias: str = "champion",
) -> Optional[str]:
    """Registers the trained model in the MLflow Model Registry and
    promotes it to `target_alias` if it clears metric_threshold."""
    setup_mlflow()

    version = register_and_promote_model(
        run_id=run_id,
        model_name=model_name,
        metric_name=metric_name,
        metric_threshold=metric_threshold,
        target_alias=target_alias,
    )

    if version:
        logger.info(f"Model promoted as '{target_alias}': version {version}")
    else:
        logger.info("Model registered but not promoted (threshold not met).")

    return version

# python -m steps.register_model_step