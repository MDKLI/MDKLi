import logging
import pandas as pd
from zenml import step

from src.scaling import (
    DataScaler,
    StandardScalingStrategy,
    MinMaxScalingStrategy
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


@step
def scaling_step(
    df: pd.DataFrame,
    strategy: str = "standard"
) -> pd.DataFrame:

    logging.info("Scaling Step Started")

    if df is None or df.empty:
        raise ValueError("Input dataframe is empty or None")

    # ===================== Strategy Selection =====================
    if strategy == "standard":
        scaler = DataScaler(StandardScalingStrategy())
    elif strategy == "minmax":
        scaler = DataScaler(MinMaxScalingStrategy())
    else:
        raise ValueError(f"Unsupported scaling strategy: {strategy}")

    # ===================== Apply Scaling =====================
    scaled_df = scaler.apply_scaling(df.copy())

    logging.info(f"Output shape: {scaled_df.shape}")
    logging.info("Scaling Step Completed")

    return scaled_df