import logging
from abc import ABC, abstractmethod

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

EPS = 1e-8


class FeatureExtractionStrategy(ABC):
    @abstractmethod
    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class CKDFeatureExtractionStrategy(FeatureExtractionStrategy):

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Starting CKD feature extraction...")

        df = df.copy()


        numeric_cols = df.select_dtypes(include="number").columns
        df[numeric_cols] = df[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

        
        
        df["bun_creatinine_ratio"] = df["bun"] / (df["serum_creatinine"] + EPS)
        df["gfr_bun_ratio"] = df["gfr"] / (df["bun"] + EPS)
        df["calcium_oxalate_ratio"] = df["serum_calcium"] / (df["oxalate_levels"] + EPS)

      
      
        c3_c4_norm = (
            df["c3_c4"] - df["c3_c4"].min()
        ) / (df["c3_c4"].max() - df["c3_c4"].min() + EPS)


        df["inflammation_score"] = (
            df["ana"].astype(float)
            + df["hematuria"].astype(float)
            + (1 - c3_c4_norm)
        )

        df["kidney_function_score"] = (
            df["gfr"]
            - 0.5 * df["serum_creatinine"]
            - 0.3 * df["bun"]
        )

        logging.info("Feature extraction completed successfully.")
        logging.info(f"Final shape: {df.shape}")

        return df


class FeatureExtractor:
    def __init__(self, strategy: FeatureExtractionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: FeatureExtractionStrategy):
        logging.info("Switching feature extraction strategy.")
        self._strategy = strategy

    def apply_feature_extraction(self, df: pd.DataFrame) -> pd.DataFrame:
        logging.info("Running feature extraction pipeline...")
        return self._strategy.apply(df)


if __name__ == "__main__":

    logging.info("Loading dataset...")

    df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    extractor = FeatureExtractor(
        strategy=CKDFeatureExtractionStrategy()
    )

    df_features = extractor.apply_feature_extraction(df)

    logging.info(f"Original shape: {df.shape}")
    logging.info(f"Feature shape: {df_features.shape}")

    print(df_features.head())