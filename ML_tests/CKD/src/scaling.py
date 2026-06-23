import logging
from abc import ABC, abstractmethod

import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler

# ===================== LOGGING =====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# ===================== STRATEGY =====================
class ScalingStrategy(ABC):
    @abstractmethod
    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


# ===================== STANDARD SCALING =====================
class StandardScalingStrategy(ScalingStrategy):
    def __init__(self):
        self.scaler = StandardScaler()

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Applying Standard Scaling...")

        df = df.copy()

        numeric_cols = df.select_dtypes(include=["number"]).columns

        df[numeric_cols] = self.scaler.fit_transform(df[numeric_cols])

        logging.info("Standard Scaling completed.")
        return df


# ===================== MINMAX SCALING =====================
class MinMaxScalingStrategy(ScalingStrategy):
    def __init__(self):
        self.scaler = MinMaxScaler()

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Applying MinMax Scaling...")

        df = df.copy()

        numeric_cols = df.select_dtypes(include=["number"]).columns

        df[numeric_cols] = self.scaler.fit_transform(df[numeric_cols])

        logging.info("MinMax Scaling completed.")
        return df


# ===================== CONTEXT =====================
class DataScaler:
    def __init__(self, strategy: ScalingStrategy, target_col: str = None):
        self._strategy = strategy
        self.target_col = target_col

    def set_strategy(self, strategy: ScalingStrategy):
        logging.info("Switching scaling strategy.")
        self._strategy = strategy

    def apply_scaling(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Running scaling pipeline...")

        df = df.copy()

        numeric_cols = df.select_dtypes(include=["number"]).columns


        if self.target_col in numeric_cols:
            numeric_cols = [c for c in numeric_cols if c != self.target_col]

        df[numeric_cols] = self._strategy.apply(df[numeric_cols])

        return df


# ===================== MAIN =====================
if __name__ == "__main__":

    logging.info("Loading dataset for scaling test...")

    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    logging.info(f"Original shape: {df.shape}")

    scaler = DataScaler(
        strategy=StandardScalingStrategy(),
        target_col="ckd_stage"   
    )

    scaled_df = scaler.apply_scaling(df)

    logging.info(f"Scaled shape: {scaled_df.shape}")

    print("\nSample after scaling:")
    print(scaled_df.head())

    print("\nStatistics after scaling:")
    print(scaled_df.describe())