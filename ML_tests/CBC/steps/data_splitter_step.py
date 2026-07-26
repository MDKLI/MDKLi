from typing import List, Tuple

import numpy as np
import pandas as pd
from zenml import step

from centralized_logging.logger import get_logger
from src.data_splitter import (
    DataSplitter,
    SimpleTrainTestSplitStrategy,
    CrossValidationSplitStrategy,
)

logger = get_logger(__name__)


@step(enable_cache=False)
def align_labels_step(X: pd.DataFrame, y: pd.Series) -> pd.Series:
    """Realigns y to X's remaining index after row-dropping steps (e.g. outlier removal)."""
    return y.loc[X.index]


@step(enable_cache=False)
def data_splitter_train_test_step(
    df: pd.DataFrame,
    target_column: str,
    test_size: float = 0.2,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Performs a stratified train/test split."""
    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in DataFrame.")

    logger.info(f"Splitting data of shape {df.shape} on target '{target_column}'.")

    strategy = SimpleTrainTestSplitStrategy(test_size=test_size, random_state=random_state)
    splitter = DataSplitter(strategy=strategy)

    X_train, X_test, y_train, y_test = splitter.split(df, target_column)

    logger.info(f"X_train: {X_train.shape}, X_test: {X_test.shape}")

    return X_train, X_test, y_train, y_test


@step(enable_cache=False)
def data_splitter_cv_step(
    df: pd.DataFrame,
    target_column: str,
    n_splits: int = 5,
    random_state: int = 42,
) -> Tuple[pd.DataFrame, pd.Series, List[Tuple[np.ndarray, np.ndarray]]]:

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found in DataFrame.")

    logger.info(f"Preparing {n_splits}-fold cross validation on data of shape {df.shape}.")

    strategy = CrossValidationSplitStrategy(n_splits=n_splits, random_state=random_state)
    splitter = DataSplitter(strategy=strategy)

    X, y, skf = splitter.split(df, target_column)

    folds = [(train_idx, val_idx) for train_idx, val_idx in skf.split(X, y)]

    logger.info(f"Generated {len(folds)} folds.")

    return X, y, folds




@step(enable_cache=False)
def select_fold_step(
    X: pd.DataFrame,
    y: pd.Series,
    folds: List[Tuple[np.ndarray, np.ndarray]],
    fold_idx: int,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Extracts a single train/validation fold by index from the fold list."""
    if fold_idx >= len(folds):
        raise ValueError(f"fold_idx {fold_idx} out of range; only {len(folds)} folds available.")

    train_idx, val_idx = folds[fold_idx]

    X_fold_train, X_fold_val = X.iloc[train_idx], X.iloc[val_idx]
    y_fold_train, y_fold_val = y.iloc[train_idx], y.iloc[val_idx]

    logger.info(
        f"Fold {fold_idx}: train shape {X_fold_train.shape}, val shape {X_fold_val.shape}"
    )

    return X_fold_train, X_fold_val, y_fold_train, y_fold_val

# python -m steps.data_splitter_step