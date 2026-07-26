import os
from abc import ABC, abstractmethod

import pandas as pd

from sklearn.model_selection import train_test_split, StratifiedKFold

from centralized_logging.logger import get_logger

logger = get_logger()


class DataSplittingStrategy(ABC):
    @abstractmethod
    def split_data(
        self,
        df: pd.DataFrame,
        target_column: str
    ):
        pass


class SimpleTrainTestSplitStrategy(DataSplittingStrategy):
    def __init__(self, test_size=0.2, random_state=42):
        self.test_size = test_size
        self.random_state = random_state

    def split_data(
        self,
        df: pd.DataFrame,
        target_column: str
    ):
        logger.info("Performing simple train-test split.")

        X = df.drop(columns=[target_column], errors="ignore")
        y = df[target_column]

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=self.test_size,
            random_state=self.random_state,
            stratify=y
        )

        logger.info("Train-test split completed.")

        return X_train, X_test, y_train, y_test


class CrossValidationSplitStrategy(DataSplittingStrategy):
    def __init__(self, n_splits=5, random_state=42):
        self.n_splits = n_splits
        self.random_state = random_state

    def split_data(
        self,
        df: pd.DataFrame,
        target_column: str
    ):
        logger.info("Performing cross validation split.")

        X = df.drop(columns=[target_column], errors="ignore")
        y = df[target_column]

        skf = StratifiedKFold(
            n_splits=self.n_splits,
            shuffle=True,
            random_state=self.random_state
        )

        logger.info("Cross validation setup completed.")

        return X, y, skf


class DataSplitter:
    def __init__(self, strategy: DataSplittingStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: DataSplittingStrategy):
        logger.info("Switching data splitting strategy.")
        self._strategy = strategy

    def split(self, df: pd.DataFrame, target_column: str):
        logger.info("Splitting data using the selected strategy.")
        return self._strategy.split_data(df, target_column)


if __name__ == "__main__":
    logger.info("Loading dataset...")
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    df = df.dropna()

    target_column = "Diagnosis"

    train_test_strategy = SimpleTrainTestSplitStrategy(test_size=0.2, random_state=42)
    splitter = DataSplitter(strategy=train_test_strategy)

    X_train, X_test, y_train, y_test = splitter.split(df, target_column)

    logger.info(f"X_train shape: {X_train.shape}")
    logger.info(f"X_test shape: {X_test.shape}")
    logger.info(f"y_train shape: {y_train.shape}")
    logger.info(f"y_test shape: {y_test.shape}")

    data_output_dir = "CBC/extracted_data"
    os.makedirs(data_output_dir, exist_ok=True)

    train_df = X_train.copy()
    train_df[target_column] = y_train.values
    test_df = X_test.copy()
    test_df[target_column] = y_test.values

    train_path = os.path.join(data_output_dir, "cbc_train.csv")
    test_path = os.path.join(data_output_dir, "cbc_test.csv")

    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)

    logger.info(f"Saved train data to: {train_path}")
    logger.info(f"Saved test data to: {test_path}")

    cv_strategy = CrossValidationSplitStrategy(n_splits=5, random_state=42)
    splitter.set_strategy(cv_strategy)

    X_cv, y_cv, skf = splitter.split(train_df, target_column)

    fold_data = []

    for fold_idx, (train_idx, val_idx) in enumerate(skf.split(X_cv, y_cv), start=1):
        X_fold_train, X_fold_val = X_cv.iloc[train_idx], X_cv.iloc[val_idx]
        y_fold_train, y_fold_val = y_cv.iloc[train_idx], y_cv.iloc[val_idx]

        logger.info(
            f"Fold {fold_idx}: train shape {X_fold_train.shape}, val shape {X_fold_val.shape}"
        )

        fold_data.append((X_fold_train, X_fold_val, y_fold_train, y_fold_val))

        fold_train_df = X_fold_train.copy()
        fold_train_df[target_column] = y_fold_train.values
        fold_val_df = X_fold_val.copy()
        fold_val_df[target_column] = y_fold_val.values

        fold_dir = os.path.join(data_output_dir, "cv_folds")
        os.makedirs(fold_dir, exist_ok=True)

        fold_train_df.to_csv(os.path.join(fold_dir, f"fold_{fold_idx}_train.csv"), index=False)
        fold_val_df.to_csv(os.path.join(fold_dir, f"fold_{fold_idx}_val.csv"), index=False)

    logger.info(f"Completed {cv_strategy.n_splits}-fold cross validation on X_train.")

    print(X_train.head())
    print(y_train.head())

# python -m src.data_splitter