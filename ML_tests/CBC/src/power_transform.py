import os
from abc import ABC, abstractmethod
from pathlib import Path

import joblib
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.preprocessing import PowerTransformer

from centralized_logging.logger import get_logger

logger = get_logger()


class PowerTransformStrategy(ABC):
    @abstractmethod
    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass

    @abstractmethod
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class YeoJohnsonStrategy(PowerTransformStrategy):
    def __init__(self):
        self.transformer = PowerTransformer(method="yeo-johnson")

    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Yeo-Johnson transformation.")
        transformed = self.transformer.fit_transform(df)
        logger.info("Yeo-Johnson transformation completed.")
        return pd.DataFrame(transformed, columns=df.columns, index=df.index)

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        transformed = self.transformer.transform(df)
        return pd.DataFrame(transformed, columns=df.columns, index=df.index)


class BoxCoxStrategy(PowerTransformStrategy):
    def __init__(self):
        self.transformer = PowerTransformer(method="box-cox")

    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Box-Cox transformation.")
        df = df.clip(lower=1e-6)
        transformed = self.transformer.fit_transform(df)
        logger.info("Box-Cox transformation completed.")
        return pd.DataFrame(transformed, columns=df.columns, index=df.index)

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.clip(lower=1e-6)
        transformed = self.transformer.transform(df)
        return pd.DataFrame(transformed, columns=df.columns, index=df.index)


class DataPowerTransformer:
    def __init__(self, strategy: PowerTransformStrategy, target_col: str | None = None):
        self._strategy = strategy
        self.target_col = target_col
        self._numeric_cols = None

    def set_strategy(self, strategy: PowerTransformStrategy):
        logger.info(f"Switching power transformation strategy to: {strategy.__class__.__name__}")
        self._strategy = strategy

    def _get_numeric_cols(self, df: pd.DataFrame):
        numeric_cols = df.select_dtypes(include=["number"]).columns
        if self.target_col and self.target_col in numeric_cols:
            numeric_cols = numeric_cols.drop(self.target_col)
            logger.info(f"Excluding target column '{self.target_col}' from transformation.")
        return numeric_cols

    def fit_apply_transformation(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Running power transformation pipeline (fit)...")
        transformed_df = df.copy()

        numeric_cols = self._get_numeric_cols(transformed_df)
        self._numeric_cols = numeric_cols

        n_before = transformed_df.shape[0]
        transformed_df = transformed_df.dropna(subset=numeric_cols)
        dropped = n_before - transformed_df.shape[0]
        if dropped:
            logger.info(f"Dropped {dropped} rows containing NaN before transformation.")

        logger.info(f"Applying transformation to {len(numeric_cols)} numeric columns.")
        transformed_df[numeric_cols] = self._strategy.fit_apply(transformed_df[numeric_cols])

        logger.info("Power transformation completed.")
        return transformed_df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Running power transformation pipeline (transform)...")
        transformed_df = df.copy()
        numeric_cols = (
            self._numeric_cols if self._numeric_cols is not None else self._get_numeric_cols(transformed_df)
        )
        transformed_df[numeric_cols] = self._strategy.transform(transformed_df[numeric_cols])
        return transformed_df

    def save_transformer(self, path: str):
        joblib.dump(self._strategy.transformer, path)
        logger.info(f"Transformer saved to: {path}")

    @classmethod
    def load(cls, strategy_cls, path: str, target_col: str | None = None):
        strategy = strategy_cls()
        strategy.transformer = joblib.load(path)
        return cls(strategy=strategy, target_col=target_col)


def plot_before_after(
    original_df: pd.DataFrame,
    transformed_df: pd.DataFrame,
    columns: list[str],
    save_dir: str = "artifacts/power_transform_plots",
):
    output_path = Path(save_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    sns.set_theme(style="whitegrid", context="talk")

    logger.info(f"Saving visualizations to: {output_path.resolve()}")

    for col in columns:
        logger.info(f"Generating visualization for: {col}")
        fig, axes = plt.subplots(nrows=1, ncols=2, figsize=(16, 6))

        sns.histplot(
            original_df[col].dropna(), bins=30, kde=True,
            ax=axes[0], color="#4C72B0", edgecolor="white", alpha=0.8,
        )
        axes[0].set_title(f"Before Transformation\n{col}", fontsize=14, fontweight="bold")
        axes[0].set_xlabel(col)
        axes[0].set_ylabel("Frequency")

        sns.histplot(
            transformed_df[col].dropna(), bins=30, kde=True,
            ax=axes[1], color="#55A868", edgecolor="white", alpha=0.8,
        )
        axes[1].set_title(f"After Transformation\n{col}", fontsize=14, fontweight="bold")
        axes[1].set_xlabel(col)
        axes[1].set_ylabel("Frequency")

        fig.suptitle(f"Power Transformation Comparison: {col}", fontsize=18, fontweight="bold", y=1.03)
        plt.tight_layout()

        file_path = output_path / f"{col}_comparison.png"
        plt.savefig(file_path, dpi=300, bbox_inches="tight")
        plt.close(fig)

        logger.info(f"Saved plot: {file_path}")


if __name__ == "__main__":
    logger.info("Loading dataset...")
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    strategy = YeoJohnsonStrategy()
    transformer_pipeline = DataPowerTransformer(strategy=strategy, target_col="Diagnosis")

    logger.info("Applying power transformation...")
    df_transformed = transformer_pipeline.fit_apply_transformation(df)

    logger.info(f"Original shape: {df.shape}")
    logger.info(f"Transformed shape: {df_transformed.shape}")

    data_output_dir = "extracted_data"
    os.makedirs(data_output_dir, exist_ok=True)

    output_path = os.path.join(data_output_dir, "cbc_power_transformed.csv")
    df_transformed.to_csv(output_path, index=False)
    logger.info(f"Saved transformed data to: {output_path}")

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    transformer_path = os.path.join(artifacts_dir, "yeo_johnson_transformer.joblib")
    transformer_pipeline.save_transformer(transformer_path)

    numeric_cols = df.select_dtypes(include=["number"]).columns.drop("Diagnosis", errors="ignore")
    plot_before_after(df, df_transformed, columns=list(numeric_cols)[:])

# python -m src.power_transform