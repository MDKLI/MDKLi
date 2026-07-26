import os
from abc import ABC, abstractmethod

import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from centralized_logging.logger import get_logger

logger = get_logger()


class ScalingStrategy(ABC):
    @abstractmethod
    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass

    @abstractmethod
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class StandardScalingStrategy(ScalingStrategy):
    def __init__(self):
        self.scaler = StandardScaler()

    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Standard Scaling...")
        df = df.copy()
        df[:] = self.scaler.fit_transform(df)
        logger.info("Standard Scaling completed.")
        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.copy()
        df[:] = self.scaler.transform(df)
        return df

    def save_scaler(self, path: str):
        joblib.dump(self.scaler, path)
        logger.info(f"Scaler saved to: {path}")

    @classmethod
    def load(cls, path: str):
        instance = cls()
        instance.scaler = joblib.load(path)
        return instance


class LogScalingStrategy(ScalingStrategy):
    def fit_apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying Log Scaling...")
        df = df.copy()
        df = df.apply(lambda x: np.log1p(x))
        logger.info("Log Scaling completed.")
        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        return self.fit_apply(df)


class DataScaler:
    def __init__(self, strategy: ScalingStrategy, target_col: str = None):
        self._strategy = strategy
        self.target_col = target_col
        self._numeric_cols = None

    def set_strategy(self, strategy: ScalingStrategy):
        logger.info(f"Switching scaling strategy to: {strategy.__class__.__name__}")
        self._strategy = strategy

    def _get_numeric_cols(self, df: pd.DataFrame):
        numeric_cols = df.select_dtypes(include=["number"]).columns
        if self.target_col and self.target_col in numeric_cols:
            numeric_cols = numeric_cols.drop(self.target_col)
        return numeric_cols

    def fit_apply_scaling(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Running scaling pipeline (fit)...")
        df = df.copy()
        numeric_cols = self._get_numeric_cols(df)
        self._numeric_cols = numeric_cols
        df[numeric_cols] = self._strategy.fit_apply(df[numeric_cols])
        logger.info("Scaling pipeline completed.")
        return df

    def transform_scaling(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Running scaling pipeline (transform)...")
        df = df.copy()
        numeric_cols = self._numeric_cols if self._numeric_cols is not None else self._get_numeric_cols(df)
        df[numeric_cols] = self._strategy.transform(df[numeric_cols])
        return df


if __name__ == "__main__":
    logger.info("Loading dataset...")
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    strategy = StandardScalingStrategy()
    scaler_pipeline = DataScaler(strategy=strategy, target_col="Diagnosis")

    logger.info("Applying scaling...")
    df_scaled = scaler_pipeline.fit_apply_scaling(df)

    logger.info(f"Original shape: {df.shape}")
    logger.info(f"Scaled shape: {df_scaled.shape}")

    data_output_dir = "extracted_data"
    os.makedirs(data_output_dir, exist_ok=True)

    output_path = os.path.join(data_output_dir, "cbc_scaling.csv")
    df_scaled.to_csv(output_path, index=False)
    logger.info(f"Saved scaled data to: {output_path}")

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)

    scaler_path = os.path.join(artifacts_dir, "standard_scaler.joblib")
    strategy.save_scaler(scaler_path)

    print(df_scaled.head())
    print("\nStatistics after scaling:")
    print(df_scaled.describe())

# python -m src.scaling