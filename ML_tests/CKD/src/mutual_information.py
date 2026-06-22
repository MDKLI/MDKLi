import logging
from abc import ABC, abstractmethod
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.feature_selection import mutual_info_classif


# ===================== LOGGING =====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


# ===================== STRATEGY =====================
class MISelectionStrategy(ABC):
    @abstractmethod
    def select_features(self, X: pd.DataFrame, y: pd.Series):
        pass


# ===================== MUTUAL INFORMATION =====================
class MutualInformationStrategy(MISelectionStrategy):
    def __init__(self, top_k: int = 10, threshold: float = None, random_state: int = 42):
        self.top_k = top_k
        self.threshold = threshold
        self.random_state = random_state

    def select_features(self, X: pd.DataFrame, y: pd.Series):

        logger.info("Applying Mutual Information Feature Selection...")

        #  keep only numeric columns (cleaner than coercion)
        X = X.select_dtypes(include=["number"]).copy()
        y = y.copy()

        # ===================== MI COMPUTATION =====================
        mi_scores = mutual_info_classif(
            X,
            y,
            random_state=self.random_state
        )

        mi_series = pd.Series(mi_scores, index=X.columns)
        mi_series = mi_series.sort_values(ascending=False)

        # ===================== SAVE RAW SCORES =====================
        artifact_dir = Path("artifacts/mi_selection")
        artifact_dir.mkdir(parents=True, exist_ok=True)

        mi_series.to_csv(artifact_dir / "mi_scores.csv")
        logger.info("Saved raw MI scores.")

        # ===================== FEATURE SELECTION =====================
        if self.threshold is not None:
            selected_features = mi_series[mi_series > self.threshold].index.tolist()
            logger.info(f"Selected features (threshold={self.threshold}): {selected_features}")
        else:
            selected_features = mi_series.index.tolist()[:self.top_k]
            logger.info(f"Selected top {self.top_k} features: {selected_features}")

        return X[selected_features], mi_series


# ===================== CONTEXT =====================
class MIFeatureSelector:
    def __init__(self, strategy: MISelectionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: MISelectionStrategy):
        logger.info("Switching MI strategy.")
        self._strategy = strategy

    def apply_selection(self, X: pd.DataFrame, y: pd.Series):
        return self._strategy.select_features(X, y)


# ===================== VISUALIZATION =====================
def plot_mi_scores(mi_scores: pd.Series, save_dir="artifacts/mi_selection"):
    path = Path(save_dir)
    path.mkdir(parents=True, exist_ok=True)

    plt.figure(figsize=(10, 6))
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


# ===================== MAIN =====================
if __name__ == "__main__":

    logger.info("Loading dataset...")

    file_path = (
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    df = pd.read_csv(file_path)

    target_col = "ckd_stage"

    X = df.drop(columns=[target_col])
    y = df[target_col]

    logger.info(f"Dataset shape: {df.shape}")

    # ===================== FEATURE SELECTION =====================
    selector = MIFeatureSelector(
        MutualInformationStrategy(top_k=10, random_state=42)
    )

    X_selected, mi_scores = selector.apply_selection(X, y)

    # ===================== VISUALIZATION =====================
    plot_mi_scores(mi_scores)

    # ===================== SAVE OUTPUT =====================
    output_path = (
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/mi_selected_features.csv"
    )

    X_selected.to_csv(output_path, index=False)

    logger.info(f"Saved selected features to: {output_path}")

    print(X_selected.head())