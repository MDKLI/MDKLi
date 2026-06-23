import logging
from abc import ABC, abstractmethod

import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


class DataSplittingStrategy(ABC):
    @abstractmethod
    def split_data(
        self,
        df: pd.DataFrame,
        target_column1: str,
        target_column2: str
    ):
        pass


class SimpleTrainTestSplitStrategy(DataSplittingStrategy):
    def __init__(self, test_size=0.2, random_state=42):
        self.test_size = test_size
        self.random_state = random_state

    def split_data(
        self,
        df: pd.DataFrame,
        target_column1: str,
        target_column2: str
    ):
        logging.info("Performing simple train-test split.")

        X = df.drop(columns=[target_column1, target_column2], errors="ignore")
        y = df[target_column1]

        X_train, X_test, y_train, y_test = train_test_split(
            X,
            y,
            test_size=self.test_size,
            random_state=self.random_state,
            stratify=y
        )

        logging.info("Train-test split completed.")

        return X_train, X_test, y_train, y_test


class CrossValidationSplitStrategy(DataSplittingStrategy):
    def __init__(self, n_splits=5, random_state=42):
        self.n_splits = n_splits
        self.random_state = random_state

    def split_data(
        self,
        df: pd.DataFrame,
        target_column1: str,
        target_column2: str
    ):
        logging.info("Performing cross validation split.")

        X = df.drop(columns=[target_column1, target_column2], errors="ignore")
        y = df[target_column1]

        skf = StratifiedKFold(
            n_splits=self.n_splits,
            shuffle=True,
            random_state=self.random_state
        )

        logging.info("Cross validation setup completed.")

        return X, y, skf


class DataSplitter:
    def __init__(self, strategy: DataSplittingStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: DataSplittingStrategy):
        logging.info("Switching data splitting strategy.")
        self._strategy = strategy

    def split(self, df: pd.DataFrame, target_column1: str, target_column2: str):
        logging.info("Splitting data using the selected strategy.")
        return self._strategy.split_data(df, target_column1, target_column2)


if __name__ == "__main__":
    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    data_splitter = DataSplitter(
        SimpleTrainTestSplitStrategy(test_size=0.2, random_state=42)
    )

    X_train, X_test, y_train, y_test = data_splitter.split(
        df,
        target_column1="ckd_stage",
        target_column2="ckd_pred"
    )


    data_splitter.set_strategy(CrossValidationSplitStrategy(n_splits=5))

    X, y, skf = data_splitter.split(
        df,
        target_column1="ckd_stage",
        target_column2="ckd_pred"
    )