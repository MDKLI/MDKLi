import os
from abc import ABC, abstractmethod

import joblib
import pandas as pd
from sklearn.preprocessing import LabelEncoder

from centralized_logging.logger import get_logger

logger = get_logger()


class FeatureEngineeringStrategy(ABC):
    @abstractmethod
    def apply_transformation(self, df: pd.DataFrame) -> pd.DataFrame:
        pass

    @abstractmethod
    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class LabelEncodingStrategy(FeatureEngineeringStrategy):
    def __init__(self, features):
        self.features = features
        self.encoders = {}

    def apply_transformation(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info(f"Applying label encoding to features: {self.features}")
        df_transformed = df.copy()

        for feature in self.features:
            encoder = LabelEncoder()
            df_transformed[feature] = encoder.fit_transform(
                df_transformed[feature].astype(str)
            )
            self.encoders[feature] = encoder

        logger.info("Label encoding completed.")
        return df_transformed

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        df_transformed = df.copy()
        for feature in self.features:
            encoder = self.encoders.get(feature)
            if encoder is None:
                raise RuntimeError(f"No fitted encoder found for feature '{feature}'.")
            df_transformed[feature] = encoder.transform(df_transformed[feature].astype(str))
        return df_transformed

    def save_encoders(self, path: str):
        joblib.dump(self.encoders, path)
        logger.info(f"Encoders saved to: {path}")

    @classmethod
    def load_encoders(cls, features, path: str):
        instance = cls(features=features)
        instance.encoders = joblib.load(path)
        return instance


class FeatureEngineer:
    def __init__(self, strategy: FeatureEngineeringStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: FeatureEngineeringStrategy):
        logger.info("Switching feature engineering strategy.")
        self._strategy = strategy

    def apply_feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Applying feature engineering strategy.")
        return self._strategy.apply_transformation(df)

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Transforming new data using fitted feature engineering strategy.")
        return self._strategy.transform(df)


if __name__ == "__main__":
    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"

    df = pd.read_csv(url)

    to_encode = df.select_dtypes(exclude="number").columns.tolist()

    strategy = LabelEncodingStrategy(features=to_encode)
    feature_engineer = FeatureEngineer(strategy)
    df_encoded = feature_engineer.apply_feature_engineering(df)

    data_output_dir = "CBC/extracted_data"
    os.makedirs(data_output_dir, exist_ok=True)
    df_encoded.to_csv(os.path.join(data_output_dir, "encoded_dataset.csv"), index=False)

    artifacts_dir = "CBC/artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    strategy.save_encoders(os.path.join(artifacts_dir, "label_encoders.joblib"))

    print("Original DataFrame shape:", df.shape)
    print("Encoded DataFrame shape:", df_encoded.shape)
    print(df_encoded.head())

    for feature, encoder in strategy.encoders.items():
        mapping = {cls_name: int(i) for i, cls_name in enumerate(encoder.classes_)}
        print(f"\n{feature} mapping: {mapping}")

# python -m src.feature_engineering