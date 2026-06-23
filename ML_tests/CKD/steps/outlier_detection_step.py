import logging

import pandas as pd
from src.outlier_detection import OutlierDetector, ZScoreOutlierDetection
from zenml import step

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


@step
def outlier_detection_step(df: pd.DataFrame, column_name: str) -> pd.DataFrame:

    logging.info(f"Starting outlier detection step with DataFrame of shape {df.shape}")

    if df is None:
        raise ValueError("Input df must be non-null pandas DataFrame.")

    if not isinstance(df, pd.DataFrame):
        raise ValueError("Input df must be a pandas DataFrame.")

    if column_name not in df.columns:
        raise ValueError(f"Column '{column_name}' does not exist in the DataFrame.")

    outlier_detector = OutlierDetector(ZScoreOutlierDetection(threshold=3))

    outliers = outlier_detector.detect_outliers(df[[column_name]])

    rows_to_keep = ~outliers[column_name]

    df_cleaned = df[rows_to_keep].reset_index(drop=True)

    logging.info(f"Removed {(~rows_to_keep).sum()} outliers from column '{column_name}'")
    logging.info(f"Output shape: {df_cleaned.shape}")

    return df_cleaned

