import pandas as pd
from src.feature_engineering import FeatureEngineer, OneHotEncoding
from zenml import step


@step
def feature_engineering_step(
    df: pd.DataFrame,
    strategy: str = "onehot_encoding",
    features: list = []
) -> pd.DataFrame:

    if features is None:
        features = df.select_dtypes(include=["object", "category"]).columns.tolist()

    if strategy == "onehot_encoding":
        engineer = FeatureEngineer(OneHotEncoding(features))

    else:
        raise ValueError(f"Unsupported feature engineering strategy: {strategy}")

    transformed_df = engineer.apply_feature_engineering(df)

    return transformed_df


#                STRATEGIES = {
#     "onehot_encoding": OneHotEncoding

# engineer = FeatureEngineer(STRATEGIES[strategy](features))