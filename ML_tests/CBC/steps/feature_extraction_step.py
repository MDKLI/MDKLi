import pandas as pd
from typing import List, Tuple
from zenml import step

from centralized_logging.logger import get_logger
from src.feature_extraction import (
    FeatureExtractor,
    CBCFeatureExtractionStrategy,
)

logger = get_logger(__name__)


@step(enable_cache=False)
def feature_extraction_step(transformed_df: pd.DataFrame) -> Tuple[pd.DataFrame, List[str]]:
    """Derives CBC domain-specific ratio and consistency-check features.

    Expects a plain DataFrame. If chained after a step that returns a
    tuple (e.g. feature_engineering_step returning (df, encoders_path)),
    unpack it in the pipeline before calling this step.
    """
    logger.info("Feature Extraction Step Started")

    if not isinstance(transformed_df, pd.DataFrame):
        raise TypeError(
            f"Expected a pandas DataFrame, got {type(transformed_df).__name__}. "
            "If chaining after feature_engineering_step, unpack its tuple output first."
        )

    if transformed_df.empty:
        raise ValueError("Input dataframe is empty")

    logger.info(f"Input shape: {transformed_df.shape}")

    extractor = FeatureExtractor(strategy=CBCFeatureExtractionStrategy())

    try:
        df_features = extractor.apply_feature_extraction(transformed_df.copy())
    except Exception as e:
        logger.error(f"Feature extraction failed: {e}")
        raise RuntimeError(f"Feature extraction failed: {e}") from e

    new_cols = set(df_features.columns) - set(transformed_df.columns)
    dropped_cols = set(transformed_df.columns) - set(df_features.columns)
    if new_cols:
        logger.info(f"New features added: {new_cols}")
    if dropped_cols:
        logger.info(f"Features dropped: {dropped_cols}")

    issues = {}
    if df_features.isnull().any().any():
        issues["NaN"] = df_features.isnull().sum().sum()
    if df_features.isin([float("inf"), float("-inf")]).any().any():
        issues["Inf"] = df_features.isin([float("inf"), float("-inf")]).sum().sum()

    for kind, count in issues.items():
        logger.warning(f"{count} {kind} values detected after feature extraction")

    logger.info(f"Output shape: {df_features.shape}")

    return df_features, df_features.columns.tolist()

# python -m steps.feature_extraction_step