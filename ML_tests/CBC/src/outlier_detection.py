from centralized_logging.logger import get_logger

import numpy as np
import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt

from abc import ABC, abstractmethod


class OutlierDetectionStrategy(ABC):
    @abstractmethod
    def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class ZScoreOutlierDetection(OutlierDetectionStrategy):
    def __init__(self, threshold=3):
        self.threshold = threshold

    def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        logger = get_logger()
        logger.info("Detecting outliers using the Z-score method.")
        z_score = np.abs((df - df.mean()) / df.std())
        outliers = z_score > self.threshold
        logger.info(f"Outliers detected with Z-score threshold: {self.threshold}.")
        return outliers


class IQROutlierDetection(OutlierDetectionStrategy):
    def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        logger = get_logger()
        logger.info("Detecting outliers using IQR.")
        Q1 = df.quantile(0.25)
        Q3 = df.quantile(0.75)
        IQR = Q3 - Q1
        outliers = ((df < (Q1 - 1.5 * IQR)) | (df > (Q3 + 1.5 * IQR)))
        logger.info("Outliers detected using IQR method.")
        return outliers


class OutlierDetector:
    def __init__(self, strategy: OutlierDetectionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: OutlierDetectionStrategy):
        logger = get_logger()
        logger.info("Switching outlier detection strategy.")
        self._strategy = strategy

    def detect_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        logger = get_logger()
        logger.info("Executing outlier detection strategy.")
        return self._strategy.detect_outliers(df)

    def handle_outliers(self, df: pd.DataFrame, method="remove", **kwargs) -> pd.DataFrame:
        logger = get_logger()
        outliers = self.detect_outliers(df)

        if method == "remove":
            logger.info("Removing outliers from the dataset.")
            df_cleaned = df[(~outliers).all(axis=1)]
            logger.info("Outlier handling complete.")
            return df_cleaned
        elif method == "cap":
            logger.info("Capping outliers using IQR bounds.")
            Q1 = df.quantile(0.25)
            Q3 = df.quantile(0.75)
            IQR = Q3 - Q1
            lower = Q1 - 1.5 * IQR
            upper = Q3 + 1.5 * IQR
            df_capped = df.clip(lower=lower, upper=upper, axis=1)
            logger.info("Outlier capping complete.")
            return df_capped
        else:
            raise ValueError(f"Unsupported outlier handling method: '{method}'")

    def visualize_outliers(self, df: pd.DataFrame, outliers: pd.DataFrame):
        logger = get_logger()
        logger.info("Visualizing outliers in the dataset.")
        plt.figure(figsize=(10, 6))
        sns.boxplot(data=df)
        plt.title("Boxplot of the Dataset with Outliers Highlighted")
        plt.show()
        logger.info("Outlier visualization complete.")


if __name__ == "__main__":

    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"

    df = pd.read_csv(url)

    df_numerical = df.select_dtypes(include=[np.number])
    outlier_detector = OutlierDetector(IQROutlierDetection())
    outlier_detector.set_strategy(ZScoreOutlierDetection())
    outliers = outlier_detector.detect_outliers(df_numerical)
    df_cleaned = outlier_detector.handle_outliers(df_numerical, method="remove")

    print("Original DataFrame shape:", df_numerical.shape)
    print("DataFrame shape after removing outliers:", df_cleaned.shape)

# python -m src.outlier_detection