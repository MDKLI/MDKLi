import logging
import joblib
import os
from typing import Tuple, Literal
import pandas as pd
from zenml import step
from src.power_transform import YeoJohnsonStrategy, BoxCoxStrategy, PowerTransformerEngine, plot_before_after

logger = logging.getLogger(__name__)


@step
def power_transform_step(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    strategy: Literal["yeo-johnson", "box-cox"] = "yeo-johnson",
    generate_plots: bool = True,
    n_plot_columns: int = 5,
) -> Tuple[pd.DataFrame, pd.DataFrame]:

    logger.info(f"Starting power transformation using '{strategy}' strategy.")

    if strategy == "yeo-johnson":
        transform_strategy = YeoJohnsonStrategy()
    elif strategy == "box-cox":
        transform_strategy = BoxCoxStrategy()
    else:
        raise ValueError(f"Unsupported strategy: {strategy}")

    numeric_cols = X_train.select_dtypes(include=["number"]).columns

    transform_strategy.transformer.fit(X_train[numeric_cols])

    X_train_transformed = X_train.copy()
    X_test_transformed = X_test.copy()

    X_train_transformed[numeric_cols] = transform_strategy.transformer.transform(X_train[numeric_cols])
    X_test_transformed[numeric_cols] = transform_strategy.transformer.transform(X_test[numeric_cols])

    os.makedirs("artifacts", exist_ok=True)
    joblib.dump(transform_strategy.transformer, "artifacts/power_transformer.pkl")
    logger.info("Power transformer saved to artifacts/power_transformer.pkl")

    if generate_plots:
        plot_cols = list(numeric_cols[:n_plot_columns])
        plot_before_after(
            original_df=X_train,
            transformed_df=X_train_transformed,
            columns=plot_cols,
        )

    logger.info("Power transformation step completed.")

    return X_train_transformed, X_test_transformed