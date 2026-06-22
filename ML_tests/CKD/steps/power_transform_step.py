import logging
from typing import Annotated, Literal

import pandas as pd
from zenml import step

from src.power_transform import (
    BoxCoxStrategy,
    PowerTransformerEngine,
    YeoJohnsonStrategy,
    plot_before_after,
)


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@step
def power_transform_step(
    df: pd.DataFrame,
    strategy: Literal["yeo-johnson", "box-cox"] = "yeo-johnson",
    target_col: str | None = None,
    generate_plots: bool = True,
    n_plot_columns: int = 5,
) -> Annotated[pd.DataFrame, "transformed_data"]:


    logger.info(
        f"Starting power transformation using '{strategy}' strategy."
    )

    if strategy == "yeo-johnson":
        transform_strategy = YeoJohnsonStrategy()

    elif strategy == "box-cox":
        transform_strategy = BoxCoxStrategy()

    else:
        raise ValueError(
            f"Unsupported strategy: {strategy}"
        )

    transformer = PowerTransformerEngine(
        strategy=transform_strategy,
        target_col=target_col,
    )

    transformed_df = transformer.apply_transform(df)

    if generate_plots:
        logger.info("Generating visualization plots.")

        numeric_cols = transformed_df.select_dtypes(
            include=["number"]
        ).columns.tolist()

        if target_col and target_col in numeric_cols:
            numeric_cols.remove(target_col)

        plot_cols = numeric_cols[:n_plot_columns]

        plot_before_after(
            original_df=df,
            transformed_df=transformed_df,
            columns=plot_cols,
        )

    logger.info("Power transformation step completed.")

    return transformed_df