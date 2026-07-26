import os
from pathlib import Path
from typing import List, Tuple, Optional

import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger
from src.mutual_information import (
    DataMISelector,
    MutualInformationStrategy,
    plot_mi_scores,
)

logger = get_logger(__name__)


@step(enable_cache=False)
def mi_selection_step(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    top_k: int = 10,
    random_state: int = 42,
    plot_dir: str = "artifacts/mi_selection",
    reference_columns: Optional[List[str]] = None,
) -> Tuple[pd.DataFrame, List[str]]:
    if reference_columns:
        missing = set(reference_columns) - set(X_train.columns)
        if missing:
            logger.warning(
                f"{len(missing)} columns present in extracted_data never reached "
                f"MI selection (dropped somewhere upstream): {sorted(missing)}"
            )

    strategy = MutualInformationStrategy(
        top_k=top_k,
        threshold=None,
        random_state=random_state,
    )
    selector = DataMISelector(strategy=strategy)

    X_train_selected, mi_scores = selector.select_features(X_train, y_train)

    os.makedirs(plot_dir, exist_ok=True)
    plot_mi_scores(mi_scores, save_dir=plot_dir)

    logger.info(f"Selected {X_train_selected.shape[1]} features out of {X_train.shape[1]}.")

    return X_train_selected, strategy.selected_features_


@step(enable_cache=False)
def filter_test_features_step(
    X_test: pd.DataFrame,
    selected_features: List[str],
) -> pd.DataFrame:
    """Applies the exact feature list selected on the training data to X_test."""
    missing_cols = [c for c in selected_features if c not in X_test.columns]
    if missing_cols:
        raise ValueError(
            f"X_test is missing columns selected on the training set: {missing_cols}"
        )

    return X_test[selected_features]


# python -m steps.mutual_information_step