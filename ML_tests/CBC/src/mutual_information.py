import json
import os
from abc import ABC, abstractmethod
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.feature_selection import mutual_info_classif

from centralized_logging.logger import get_logger

logger = get_logger()


class MISelectionStrategy(ABC):
    @abstractmethod
    def select_features(self, X: pd.DataFrame, y: pd.Series):
        pass

    @abstractmethod
    def apply(self, X: pd.DataFrame) -> pd.DataFrame:
        pass


class MutualInformationStrategy(MISelectionStrategy):
    def __init__(self, top_k: int = 15, threshold: float = None, random_state: int = 42):
        self.top_k = top_k
        self.threshold = threshold
        self.random_state = random_state
        self.selected_features_ = None

    def select_features(self, X: pd.DataFrame, y: pd.Series):
        logger.info("Applying Mutual Information Feature Selection...")

        X_numeric = X.select_dtypes(include=["number"]).copy()
        dropped_cols = set(X.columns) - set(X_numeric.columns)
        if dropped_cols:
            logger.info(f"Dropped non-numeric columns before MI selection: {sorted(dropped_cols)}")

        y = y.copy()

        mi_scores = mutual_info_classif(X_numeric, y, random_state=self.random_state)

        mi_series = pd.Series(mi_scores, index=X_numeric.columns)
        mi_series = mi_series.sort_values(ascending=False)

        artifact_dir = Path("artifacts/mi_selection")
        artifact_dir.mkdir(parents=True, exist_ok=True)

        mi_series.to_csv(artifact_dir / "mi_scores.csv")
        logger.info("Saved raw MI scores.")

        if self.threshold is not None:
            selected_features = mi_series[mi_series >= self.threshold].index.tolist()
            logger.info(f"Selected {len(selected_features)} features with MI >= {self.threshold}.")
        else:
            selected_features = mi_series.head(self.top_k).index.tolist()
            logger.info(f"Selected top {self.top_k} features: {selected_features}")

        self.selected_features_ = selected_features

        with open(artifact_dir / "selected_features.json", "w") as f:
            json.dump(selected_features, f, indent=2)
        logger.info("Saved selected feature list.")

        return X_numeric[selected_features], mi_series

    def apply(self, X: pd.DataFrame) -> pd.DataFrame:
        if self.selected_features_ is None:
            raise RuntimeError(
                "No features selected yet. Call select_features() first, "
                "or load a saved feature list via load_selected_features()."
            )
        return X[self.selected_features_]

    def load_selected_features(self, path: str):
        with open(path) as f:
            self.selected_features_ = json.load(f)
        logger.info(f"Loaded selected feature list from: {path}")
        return self.selected_features_


class DataMISelector:
    def __init__(self, strategy: MISelectionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: MISelectionStrategy):
        logger.info(f"Switching MI selection strategy to: {strategy.__class__.__name__}")
        self._strategy = strategy

    def select_features(self, X: pd.DataFrame, y: pd.Series):
        logger.info("Running Mutual Information feature selection pipeline...")
        return self._strategy.select_features(X, y)

    def apply(self, X: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying previously selected features to new data...")
        return self._strategy.apply(X)


def plot_mi_scores(mi_scores: pd.Series, save_dir="artifacts/mi_selection"):
    path = Path(save_dir)
    path.mkdir(parents=True, exist_ok=True)

    plt.figure(figsize=(15, 12))
    sns.barplot(
        x=mi_scores.values,
        y=mi_scores.index
    )

    plt.title("Mutual Information Feature Importance")
    plt.xlabel("MI Score")
    plt.ylabel("Features")

    file_path = path / "mi_scores.png"
    plt.tight_layout()
    plt.savefig(file_path, dpi=300)
    plt.close()

    logger.info(f"Saved MI plot to: {file_path}")


if __name__ == "__main__":
    from sklearn.model_selection import train_test_split

    logger.info("Loading dataset...")
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    target_col = "Diagnosis"

    n_before = df.shape[0]
    df = df.dropna()
    logger.info(f"Dropped {n_before - df.shape[0]} rows containing NaN.")

    train_df, test_df = train_test_split(
        df, test_size=0.2, random_state=42, stratify=df[target_col]
    )

    X_train = train_df.drop(columns=[target_col])
    y_train = train_df[target_col]
    X_test = test_df.drop(columns=[target_col])
    y_test = test_df[target_col]

    strategy = MutualInformationStrategy(top_k=15, random_state=42)
    selector = DataMISelector(strategy=strategy)

    logger.info("Running feature selection on training data only...")
    X_train_selected, mi_scores = selector.select_features(X_train, y_train)
    X_test_selected = selector.apply(X_test)

    logger.info(f"Original feature count: {X_train.shape[1]}")
    logger.info(f"Selected feature count: {X_train_selected.shape[1]}")

    data_output_dir = "extracted_data"
    os.makedirs(data_output_dir, exist_ok=True)

    train_out = X_train_selected.copy()
    train_out[target_col] = y_train.values
    test_out = X_test_selected.copy()
    test_out[target_col] = y_test.values

    train_path = os.path.join(data_output_dir, "cbc_mi_selected_train.csv")
    test_path = os.path.join(data_output_dir, "cbc_mi_selected_test.csv")

    train_out.to_csv(train_path, index=False)
    test_out.to_csv(test_path, index=False)
    logger.info(f"Saved MI-selected train data to: {train_path}")
    logger.info(f"Saved MI-selected test data to: {test_path}")

    plot_mi_scores(mi_scores, save_dir="artifacts/mi_selection")

    print(X_train_selected.head())
    print("\nTop features by MI score:")
    print(mi_scores.head(15))

# python -m src.mutual_information