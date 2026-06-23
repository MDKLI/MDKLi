import pandas as pd
from src.feature_engineering import FeatureEngineer, OneHotEncoding
from zenml import step
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)

@step
def feature_engineering_step(
    df: pd.DataFrame,
    strategy: str = "onehot_encoding",
    features: Optional[List[str]] = None,
    drop_columns: Optional[List[str]] = None,  
) -> pd.DataFrame:

    try:
        logger.info(f"Data shape: {df.shape}")

        if features is None:
            features = df.select_dtypes(exclude="number").columns.tolist()
            logger.info(f"Auto-detected categorical features: {features}")

        if not features:
            logger.warning("No categorical features found, returning df as-is.")
            return df

        if strategy == "onehot_encoding":
            engineer = FeatureEngineer(OneHotEncoding(features))
        else:
            raise ValueError(f"Unsupported feature engineering strategy: {strategy}")

        transformed_df = engineer.apply_feature_engineering(df)

        if drop_columns:
            cols_to_drop = [c for c in drop_columns if c in transformed_df.columns]
            transformed_df = transformed_df.drop(columns=cols_to_drop)
            logger.info(f"Dropped leakage columns: {cols_to_drop}")

        logger.info(f"Transformed data shape: {transformed_df.shape}")
        return transformed_df

    except Exception as e:
        logger.error(f"feature_engineering_step failed: {e}", exc_info=True)
        raise
#                STRATEGIES = {
#     "onehot_encoding": OneHotEncoding

# engineer = FeatureEngineer(STRATEGIES[strategy](features))