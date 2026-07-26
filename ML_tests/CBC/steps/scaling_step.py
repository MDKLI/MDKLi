import os
from typing import List, Optional, Tuple

import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger
from src.scaling import DataScaler, StandardScalingStrategy, LogScalingStrategy

logger = get_logger(__name__)


@step(enable_cache=False)
def scaling_step(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    strategy: str = "standard",
    target_col: Optional[str] = None,
) -> Tuple[pd.DataFrame, pd.DataFrame, str, List[str]]:

    logger.info("Scaling Step Started")

    numeric_columns = X_train.select_dtypes(include="number").columns.tolist()
    if target_col and target_col in numeric_columns:
        numeric_columns.remove(target_col)

    if strategy == "standard":
        inner_strategy = StandardScalingStrategy()
    elif strategy == "log":
        inner_strategy = LogScalingStrategy()
    else:
        raise ValueError(f"Unsupported scaling strategy: {strategy}")

    data_scaler = DataScaler(strategy=inner_strategy, target_col=target_col)

    X_train_scaled = data_scaler.fit_apply_scaling(X_train)
    X_test_scaled = data_scaler.transform_scaling(X_test)

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    scaler_path = ""
    if hasattr(inner_strategy, "save_scaler"):
        scaler_path = os.path.join(artifacts_dir, "scaler.joblib")
        inner_strategy.save_scaler(scaler_path)
        logger.info(f"Scaler saved to: {scaler_path}")
    else:
        logger.info(f"Strategy '{strategy}' is stateless; no scaler artifact to save.")

    logger.info(f"Train shape: {X_train_scaled.shape}, Test shape: {X_test_scaled.shape}")

    return X_train_scaled, X_test_scaled, scaler_path, numeric_columns

# python -m steps.scaling_step