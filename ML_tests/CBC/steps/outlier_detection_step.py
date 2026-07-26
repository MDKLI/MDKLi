from typing import List, Optional

import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger
from src.outlier_detection import OutlierDetector, ZScoreOutlierDetection

logger = get_logger(__name__)


@step(enable_cache=False)
def outlier_detection_step(
    df: pd.DataFrame,
    columns: Optional[List[str]] = None,
    target_col: Optional[str] = None,
    threshold: float = 3,
    method: str = "remove",
) -> pd.DataFrame:

    logger.info(f"Starting outlier detection step with DataFrame of shape {df.shape}")

    if not isinstance(df, pd.DataFrame):
        raise TypeError("Input df must be a pandas DataFrame.")

    if df.empty:
        raise ValueError("Input dataframe is empty.")

    if columns is None:
        columns = df.select_dtypes(include="number").columns.tolist()
        if target_col and target_col in columns:
            columns.remove(target_col)
        logger.info(f"Auto-detected numeric columns for outlier detection: {columns}")

    missing_cols = [c for c in columns if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Columns not found in DataFrame: {missing_cols}")

    outlier_detector = OutlierDetector(ZScoreOutlierDetection(threshold=threshold))

    other_cols = [c for c in df.columns if c not in columns]
    df_checked = outlier_detector.handle_outliers(df[columns], method=method)

    if method == "remove":
        df_cleaned = df.loc[df_checked.index]
        n_removed = df.shape[0] - df_cleaned.shape[0]
        logger.info(f"Removed {n_removed} rows containing outliers across {len(columns)} columns.")
    else:
        df_cleaned = df.copy()
        df_cleaned[columns] = df_checked
        logger.info(f"Capped outlier values across {len(columns)} columns.")

    logger.info(f"Output shape: {df_cleaned.shape}")

    return df_cleaned


# python -m steps.outlier_detection_step