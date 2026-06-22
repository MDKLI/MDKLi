from typing import Tuple
import pandas as pd
from sklearn.model_selection import StratifiedKFold

from src.data_splitter import (
    DataSplitter,
    SimpleTrainTestSplitStrategy,
    CrossValidationSplitStrategy
)

from zenml import step


@step
def data_splitter_train_test_step(
    df: pd.DataFrame,
    target_column1: str,
    target_column2: str
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:

    splitter = DataSplitter(strategy=SimpleTrainTestSplitStrategy())

    X_train, X_test, y_train, y_test = splitter.split(
        df,
        target_column1,
        target_column2
    )

    return X_train, X_test, y_train, y_test


@step
def data_splitter_cv_step(
    df: pd.DataFrame,
    target_column1: str,
    target_column2: str
) -> Tuple[pd.DataFrame, pd.Series, StratifiedKFold]:

    splitter = DataSplitter(strategy=CrossValidationSplitStrategy())

    X, y, skf = splitter.split(
        df,
        target_column1,
        target_column2
    )

    return X, y, skf

# in terminal
# cd "D:\Work\Healthcare project\MDKLi\ML_tests\CKD"
# python -m steps.data_splitter_step