from abc import ABC, abstractmethod

import numpy as np
import pandas as pd

from centralized_logging.logger import get_logger

logger = get_logger()

EPS = 1e-8


class FeatureExtractionStrategy(ABC):
    @abstractmethod
    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        pass


class CBCFeatureExtractionStrategy(FeatureExtractionStrategy):

    PHYSIOLOGICAL_RANGES = {
        'WBC': (1, 50), 'RBC': (1, 8), 'HGB': (2, 22), 'HCT': (10, 65),
        'MCV': (50, 120), 'MCH': (10, 45), 'MCHC': (20, 40),
        'PLT': (10, 700), 'PDW': (5, 25), 'PCT': (0.01, 0.5)
    }

    def __init__(self, out_of_range_strategy: str = "drop"):
        if out_of_range_strategy not in ("drop", "impute_median"):
            raise ValueError(f"Unsupported out_of_range_strategy: '{out_of_range_strategy}'")
        self.out_of_range_strategy = out_of_range_strategy

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Starting CBC feature extraction...")

        df = df.copy()

        df = self._clean(df)
        df = self._add_ratio_features(df)
        df = self._add_consistency_checks(df)

        logger.info("Feature extraction completed successfully.")
        logger.info(f"Final shape: {df.shape}")

        return df

    def _clean(self, df: pd.DataFrame) -> pd.DataFrame:
        before = df.shape[0]
        df = df.drop_duplicates()

        cols_with_ranges = [c for c in self.PHYSIOLOGICAL_RANGES if c in df.columns]

        for col, (low, high) in self.PHYSIOLOGICAL_RANGES.items():
            if col in df.columns:
                out_of_range = (df[col] < low) | (df[col] > high)
                n_out = int(out_of_range.sum())
                if n_out:
                    logger.info(f"{n_out} out-of-range values found in '{col}'.")
                df.loc[out_of_range, col] = np.nan

        if self.out_of_range_strategy == "drop":
            df = df.dropna()
            logger.info(f"Cleaning removed {before - df.shape[0]} rows.")
        else:
            df[cols_with_ranges] = df[cols_with_ranges].fillna(df[cols_with_ranges].median())
            df = df.dropna()
            logger.info(
                f"Imputed out-of-range values with column medians; "
                f"{before - df.shape[0]} rows dropped due to remaining NaNs elsewhere."
            )

        return df

    def _add_ratio_features(self, df: pd.DataFrame) -> pd.DataFrame:
        required_pairs = {
            'NLR': ('NEUTn', 'LYMn'),
            'PLR': ('PLT', 'LYMn'),
            'Mentzer_Index': ('MCV', 'RBC'),
            'MCV_MCH_ratio': ('MCV', 'MCH'),
            'anemia_score': ('HGB', 'MCV'),
            'PLT_RBC_ratio': ('PLT', 'RBC'),
            'RPR': ('PDW', 'PLT'),
        }

        for feature_name, (numerator_col, denominator_col) in required_pairs.items():
            if numerator_col in df.columns and denominator_col in df.columns:
                df[feature_name] = df[numerator_col] / (df[denominator_col] + EPS)
            else:
                logger.warning(
                    f"Skipping feature '{feature_name}'; missing column(s): "
                    f"{[c for c in (numerator_col, denominator_col) if c not in df.columns]}"
                )

        return df

    def _add_consistency_checks(self, df: pd.DataFrame) -> pd.DataFrame:
        required_cols = {'LYMp', 'NEUTp', 'WBC', 'NEUTn'}
        if required_cols.issubset(df.columns):
            df['diff_sum'] = df['LYMp'] + df['NEUTp']
            df['NEUTn_calc'] = df['WBC'] * df['NEUTp'] / 100
            df['NEUTn_diff'] = np.abs(df['NEUTn_calc'] - df['NEUTn'])
        else:
            logger.warning(
                f"Skipping consistency checks; missing column(s): "
                f"{required_cols - set(df.columns)}"
            )

        return df


class FeatureExtractor:
    def __init__(self, strategy: FeatureExtractionStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: FeatureExtractionStrategy):
        logger.info("Switching feature extraction strategy.")
        self._strategy = strategy

    def apply_feature_extraction(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Running feature extraction pipeline...")
        return self._strategy.apply(df)


if __name__ == "__main__":
    import os

    logger.info("Loading dataset...")

    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    extractor = FeatureExtractor(strategy=CBCFeatureExtractionStrategy())
    df_features = extractor.apply_feature_extraction(df)

    logger.info(f"Original shape: {df.shape}")
    logger.info(f"Feature shape: {df_features.shape}")

    output_path = "extracted_data/cbc_features.csv"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df_features.to_csv(output_path, index=False)
    logger.info(f"Saved extracted features to: {output_path}")

    print(df_features.head())

# python -m src.feature_extraction