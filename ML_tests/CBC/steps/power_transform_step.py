import os
from typing import Literal, Optional, Tuple

import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger
from src.power_transform import (
    DataPowerTransformer,
    YeoJohnsonStrategy,
    BoxCoxStrategy,
    plot_before_after,
)

logger = get_logger(__name__)


@step(enable_cache=False)
def power_transform_step(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    strategy: Literal["yeo-johnson", "box-cox"] = "yeo-johnson",
    target_col: Optional[str] = None,
    generate_plots: bool = True,
    n_plot_columns: int = 5,
) -> Tuple[pd.DataFrame, pd.DataFrame, str]:

    logger.info(f"Starting power transformation using '{strategy}' strategy.")

    if strategy == "yeo-johnson":
        inner_strategy = YeoJohnsonStrategy()
    elif strategy == "box-cox":
        inner_strategy = BoxCoxStrategy()
    else:
        raise ValueError(f"Unsupported strategy: {strategy}")

    transformer_pipeline = DataPowerTransformer(strategy=inner_strategy, target_col=target_col)

    X_train_transformed = transformer_pipeline.fit_apply_transformation(X_train)
    X_test_transformed = transformer_pipeline.transform(X_test)

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    transformer_path = os.path.join(artifacts_dir, f"{strategy.replace('-', '_')}_transformer.joblib")
    transformer_pipeline.save_transformer(transformer_path)
    logger.info(f"Power transformer saved to: {transformer_path}")

    if generate_plots:
        numeric_cols = X_train.select_dtypes(include=["number"]).columns
        if target_col and target_col in numeric_cols:
            numeric_cols = numeric_cols.drop(target_col)
        plot_cols = list(numeric_cols[:n_plot_columns])
        plot_before_after(
            original_df=X_train,
            transformed_df=X_train_transformed,
            columns=plot_cols,
        )

    logger.info("Power transformation step completed.")
    logger.info(f"Train shape: {X_train_transformed.shape}, Test shape: {X_test_transformed.shape}")

    return X_train_transformed, X_test_transformed, transformer_path


# python -m steps.power_transform_step