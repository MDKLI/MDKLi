import logging
from abc import ABC, abstractmethod
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns
from sklearn.preprocessing import PowerTransformer


# ===================== LOGGING =====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


# ===================== STRATEGY =====================
class PowerTransformStrategy(ABC):
    @abstractmethod
    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


# ===================== YEO-JOHNSON =====================
class YeoJohnsonStrategy(PowerTransformStrategy):
    def __init__(self):
        self.transformer = PowerTransformer(method="yeo-johnson")

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Yeo-Johnson transformation.")

        transformed = self.transformer.fit_transform(df)

        logger.info("Yeo-Johnson transformation completed.")

        return pd.DataFrame(
            transformed,
            columns=df.columns,
            index=df.index,
        )


# ===================== BOX-COX =====================
class BoxCoxStrategy(PowerTransformStrategy):
    def __init__(self):
        self.transformer = PowerTransformer(method="box-cox")

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Box-Cox transformation.")

        df = df.clip(lower=1e-6)

        transformed = self.transformer.fit_transform(df)

        logger.info("Box-Cox transformation completed.")

        return pd.DataFrame(
            transformed,
            columns=df.columns,
            index=df.index,
        )


# ===================== CONTEXT =====================
class PowerTransformerEngine:
    def __init__(
        self,
        strategy: PowerTransformStrategy,
        target_col: str | None = None,
    ):
        self._strategy = strategy
        self._target_col = target_col

    def set_strategy(self, strategy: PowerTransformStrategy):
        logger.info(
            f"Switching strategy to {strategy.__class__.__name__}"
        )
        self._strategy = strategy

    def apply_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Starting power transformation pipeline.")

        transformed_df = df.copy()

        numeric_cols = transformed_df.select_dtypes(
            include=["number"]
        ).columns.tolist()

        if self._target_col and self._target_col in numeric_cols:
            numeric_cols.remove(self._target_col)

            logger.info(
                f"Excluded target column: {self._target_col}"
            )

        logger.info(
            f"Applying transformation to {len(numeric_cols)} numeric columns."
        )

        transformed_df[numeric_cols] = self._strategy.apply(
            transformed_df[numeric_cols]
        )

        logger.info("Power transformation pipeline completed.")

        return transformed_df


# ===================== VISUALIZATION =====================
def plot_before_after(
    original_df: pd.DataFrame,
    transformed_df: pd.DataFrame,
    columns: list[str],
    save_dir: str = "artifacts/power_transform_plots",
):
    output_path = Path(save_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    sns.set_theme(
        style="whitegrid",
        context="talk",
    )

    logger.info(
        f"Saving visualizations to: {output_path.resolve()}"
    )

    for col in columns:

        logger.info(f"Generating visualization for: {col}")

        fig, axes = plt.subplots(
            nrows=1,
            ncols=2,
            figsize=(16, 6),
        )

        sns.histplot(
            original_df[col].dropna(),
            bins=30,
            kde=True,
            ax=axes[0],
            color="#4C72B0",
            edgecolor="white",
            alpha=0.8,
        )

        axes[0].set_title(
            f"Before Transformation\n{col}",
            fontsize=14,
            fontweight="bold",
        )
        axes[0].set_xlabel(col)
        axes[0].set_ylabel("Frequency")

        sns.histplot(
            transformed_df[col].dropna(),
            bins=30,
            kde=True,
            ax=axes[1],
            color="#55A868",
            edgecolor="white",
            alpha=0.8,
        )

        axes[1].set_title(
            f"After Transformation\n{col}",
            fontsize=14,
            fontweight="bold",
        )
        axes[1].set_xlabel(col)
        axes[1].set_ylabel("Frequency")

        fig.suptitle(
            f"Power Transformation Comparison: {col}",
            fontsize=18,
            fontweight="bold",
            y=1.03,
        )

        plt.tight_layout()

        file_path = output_path / f"{col}_comparison.png"

        plt.savefig(
            file_path,
            dpi=300,
            bbox_inches="tight",
        )

        plt.close(fig)

        logger.info(f"Saved plot: {file_path}")


# ===================== MAIN =====================
if __name__ == "__main__":

    logger.info("Loading dataset.")

    input_path = (
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    output_path = (
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/transformed_ckd_dataset.csv"
    )

    df = pd.read_csv(input_path)

    logger.info(
        f"Dataset loaded successfully. Shape: {df.shape}"
    )

    transformer = PowerTransformerEngine(
        strategy=YeoJohnsonStrategy(),
        target_col="ckd_stage",
    )

    transformed_df = transformer.apply_transform(df)

    numeric_cols = transformed_df.select_dtypes(
        include=["number"]
    ).columns.tolist()

    if "ckd_stage" in numeric_cols:
        numeric_cols.remove("ckd_stage")

    plot_cols = numeric_cols[:-1]

    logger.info(
        f"Generating visualizations for columns: {plot_cols}"
    )

    plot_before_after(
        original_df=df,
        transformed_df=transformed_df,
        columns=plot_cols,
    )

    transformed_df.to_csv(
        output_path,
        index=False,
    )

    logger.info(
        f"Transformed dataset saved to: {output_path}"
    )

    logger.info("Power transformation workflow completed.")

    print(transformed_df.head())

