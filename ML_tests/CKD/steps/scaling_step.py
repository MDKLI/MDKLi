import logging
import joblib
import os
from typing import Tuple
import pandas as pd
from zenml import step
from src.scaling import DataScaler, StandardScalingStrategy, MinMaxScalingStrategy

logger = logging.getLogger(__name__)


@step
def scaling_step(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    strategy: str = "standard"
) -> Tuple[pd.DataFrame, pd.DataFrame]:

    logger.info("Scaling Step Started")

    if strategy == "standard":
        scaling_strategy = StandardScalingStrategy()
    elif strategy == "minmax":
        scaling_strategy = MinMaxScalingStrategy()
    else:
        raise ValueError(f"Unsupported scaling strategy: {strategy}")

    numeric_cols = X_train.select_dtypes(include=["number"]).columns

    scaling_strategy.scaler.fit(X_train[numeric_cols])

    X_train_scaled = X_train.copy()
    X_test_scaled = X_test.copy()

    X_train_scaled[numeric_cols] = scaling_strategy.scaler.transform(X_train[numeric_cols])
    X_test_scaled[numeric_cols] = scaling_strategy.scaler.transform(X_test[numeric_cols])

    os.makedirs("artifacts", exist_ok=True)
    joblib.dump(scaling_strategy.scaler, "artifacts/scaler.pkl")
    logger.info("Scaler saved to artifacts/scaler.pkl")

    logger.info(f"Train shape: {X_train_scaled.shape}, Test shape: {X_test_scaled.shape}")

    return X_train_scaled, X_test_scaled