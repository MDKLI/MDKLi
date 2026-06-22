import logging
import os

import pandas as pd
from zenml import step

from src.mutual_information import (
    MIFeatureSelector,
    MutualInformationStrategy,
    plot_mi_scores
)

logger = logging.getLogger(__name__)


@step
def mi_selection_step(
    X: pd.DataFrame,
    y: pd.Series,
    top_k: int = 10,
    random_state: int = 42,
    save_path: str = "artifacts/mi_selected_features.csv",
    plot_path: str = "artifacts/mi_selection"
) -> pd.DataFrame:

    selector = MIFeatureSelector(
        MutualInformationStrategy(
            top_k=top_k,
            threshold=None,
            random_state=random_state
        )
    )

    X = X.select_dtypes(include=["number"])
    y = y.astype(int)

    X_selected, mi_scores = selector.apply_selection(X, y)

    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    os.makedirs(plot_path, exist_ok=True)

    plot_mi_scores(mi_scores, save_dir=plot_path)
    X_selected.to_csv(save_path, index=False)

    logger.info(f"Selected {X_selected.shape[1]} features")

    return X_selected


@step
def filter_test_features_step(
    X_test: pd.DataFrame,
    X_train_selected: pd.DataFrame
) -> pd.DataFrame:
    common_cols = [col for col in X_train_selected.columns if col in X_test.columns]
    return X_test[common_cols]