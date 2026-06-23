import logging
import joblib
import pandas as pd
from sklearn.preprocessing import StandardScaler, PowerTransformer
from zenml import step

logger = logging.getLogger(__name__)


@step
def save_inference_preprocessors_step(
    X_train_selected: pd.DataFrame,
) -> None:

    selected_features = X_train_selected.columns.tolist()

    scaler = StandardScaler()
    df_scaled = pd.DataFrame(
        scaler.fit_transform(X_train_selected),
        columns=selected_features
    )

    power_transformer = PowerTransformer(method="yeo-johnson")
    power_transformer.fit(df_scaled)

    joblib.dump(scaler, "artifacts/inference_scaler.pkl")
    joblib.dump(power_transformer, "artifacts/inference_power_transformer.pkl")

    logger.info(f"Inference preprocessors saved for features: {selected_features}")