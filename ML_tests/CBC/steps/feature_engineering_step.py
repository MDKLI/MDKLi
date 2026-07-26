import os
from typing import List, Optional, Tuple

import pandas as pd
from zenml import step

from src.feature_engineering import FeatureEngineer, LabelEncodingStrategy
from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@step(enable_cache=False)
def feature_engineering_step(
    df: pd.DataFrame,
    strategy: str = "label_encoding",
    features: Optional[List[str]] = None,
    drop_columns: Optional[List[str]] = None,
    target_column: Optional[str] = None,
) -> Tuple[pd.DataFrame, str]:

    try:
        logger.info(f"Data shape: {df.shape}")
        if features is None:
           features = df.select_dtypes(exclude="number").columns.tolist()
           if target_column and target_column in features:
              features.remove(target_column)
           logger.info(f"Auto-detected categorical features: {features}")

        if not features:
            logger.warning("No categorical features found, returning df as-is.")
            return df, ""

        if strategy == "label_encoding":
            fe_strategy = LabelEncodingStrategy(features)
        else:
            raise ValueError(f"Unsupported feature engineering strategy: {strategy}")

        engineer = FeatureEngineer(fe_strategy)
        transformed_df = engineer.apply_feature_engineering(df)

        if drop_columns:
            cols_to_drop = [c for c in drop_columns if c in transformed_df.columns]
            transformed_df = transformed_df.drop(columns=cols_to_drop)
            logger.info(f"Dropped leakage columns: {cols_to_drop}")

        artifacts_dir = "artifacts"
        os.makedirs(artifacts_dir, exist_ok=True)
        encoders_path = os.path.join(artifacts_dir, "label_encoders.joblib")
        fe_strategy.save_encoders(encoders_path)

        logger.info(f"Transformed data shape: {transformed_df.shape}")
        return transformed_df, encoders_path

    except Exception as e:
        logger.error(f"feature_engineering_step failed: {e}", exc_info=True)
        raise ValueError(f"feature_engineering_step failed: {e}") from e
    

# python -m steps.feature_engineering_step