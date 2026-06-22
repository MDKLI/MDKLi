import logging
from abc import ABC, abstractmethod

import pandas as pd
from sklearn.preprocessing import OneHotEncoder

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")


class FeatureEngineeringStrategy(ABC):
               @abstractmethod
               def apply_transformation(self, df: pd.DataFrame) -> pd.DataFrame:
                       pass


class OneHotEncoding(FeatureEngineeringStrategy):
        def __init__(self, features):
                self.features = features
                self.encoder = OneHotEncoder(sparse_output=False, drop="first")

        def apply_transformation(self, df: pd.DataFrame) -> pd.DataFrame:
                logging.info(f"Applying one-hot encoding to features: {self.features}")
                df_transformed = df.copy()

                encoded_df = pd.DataFrame(
                        self.encoder.fit_transform(df[self.features]),
                        columns=self.encoder.get_feature_names_out(self.features),
                        index=df.index
                )

                df_transformed = df_transformed.drop(columns=self.features).reset_index(drop=True)
                encoded_df = encoded_df.reset_index(drop=True)

                df_transformed = pd.concat([df_transformed, encoded_df], axis=1)

                logging.info("One-hot encoding completed.")
                return df_transformed


class FeatureEngineer:
        def __init__(self, strategy: FeatureEngineeringStrategy):
                self._strategy = strategy

        def set_strategy(self, strategy: FeatureEngineeringStrategy):
                logging.info("Switching feature engineering strategy.")
                self._strategy = strategy

        def apply_feature_engineering(self, df: pd.DataFrame) -> pd.DataFrame:
                logging.info("Applying feature engineering strategy.")
                return self._strategy.apply_transformation(df)


if __name__ == "__main__":
     
     df = pd.read_csv(
        "D:/Work/Healthcare project/MDKLi/ML_tests/CKD/"
        "extracted_data/updated_ckd_dataset_with_stages.csv"
    )
     
     to_encode = df.select_dtypes(exclude="number").columns.tolist()
     
     onehot_encoder = FeatureEngineer(OneHotEncoding(features=to_encode))
