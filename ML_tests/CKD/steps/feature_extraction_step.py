import logging
import pandas as pd
from zenml import step

from src.feature_extraction import (
    FeatureExtractor,
    CKDFeatureExtractionStrategy
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


@step
def feature_extraction_step(transformed_df: pd.DataFrame) -> pd.DataFrame:

    logging.info("Feature Extraction Step Started")

    if not isinstance(transformed_df, pd.DataFrame):
        transformed_df = pd.DataFrame(transformed_df)

    if transformed_df is None or transformed_df.empty:
        raise ValueError("Input dataframe is empty or None")

    logging.info(f"Input shape: {transformed_df.shape}")

    extractor = FeatureExtractor(
        strategy=CKDFeatureExtractionStrategy()
    )

    try:
        df_features = extractor.apply_feature_extraction(transformed_df.copy())
    except Exception as e:
        logging.error(f"Feature extraction failed: {e}")
        raise RuntimeError(f"Feature extraction failed: {e}") from e

    new_cols = set(df_features.columns) - set(transformed_df.columns)
    dropped_cols = set(transformed_df.columns) - set(df_features.columns)
    if new_cols:
        logging.info(f"New features added: {new_cols}")
    if dropped_cols:
        logging.info(f"Features dropped: {dropped_cols}")

    issues = {}
    if df_features.isnull().any().any():
        issues["NaN"] = df_features.isnull().sum().sum()
    if df_features.isin([float("inf"), float("-inf")]).any().any():
        issues["Inf"] = df_features.isin([float("inf"), float("-inf")]).sum().sum()

    for kind, count in issues.items():
        logging.warning(f"{count} {kind} values detected after feature extraction")

    logging.info(f"Output shape: {df_features.shape}")

    return df_features