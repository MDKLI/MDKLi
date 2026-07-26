from zenml import pipeline, Model

from steps.data_ingestion_step import data_ingestion_step
from steps.feature_engineering_step import feature_engineering_step
from steps.feature_extraction_step import feature_extraction_step
from steps.outlier_detection_step import outlier_detection_step
from steps.data_splitter_step import data_splitter_train_test_step, align_labels_step
from steps.target_encoding_step import target_encoding_step
from steps.scaling_step import scaling_step
from steps.power_transform_step import power_transform_step
from steps.mutual_information_step import mi_selection_step, filter_test_features_step
from steps.save_inference_preprocessors_step import save_inference_preprocessors_step
from steps.model_building_step import build_model_step
from steps.train_model import train_model_step
from steps.train_hierarchical_model_step import train_hierarchical_model_step
from steps.model_evaluator_step import evaluate_model_step
from steps.register_model_step import register_model_step

import os

DATA_PATH = os.environ.get("CBC_DATA_PATH", "data/raw/cbc_dataset.csv")

TARGET_COLUMN = "Diagnosis"
MODEL_NAME = "CBC Prediction Model"


@pipeline(
    model=Model(name=MODEL_NAME),
    enable_cache=False,
)
def cbc_ml_pipeline(
    model_mode: str = "standard",
    model_type: str = "rf",
    promotion_metric: str = "f1_score",
    promotion_threshold: float = 0.75,
):
    # ===================== 1. DATA INGESTION =====================
    raw_data = data_ingestion_step(file_path=DATA_PATH, file_type=".csv")

    # ===================== 2. FEATURE ENGINEERING =====================
    engineered_data, feature_encoders_path = feature_engineering_step(
        raw_data,
        strategy="label_encoding",
        target_column=TARGET_COLUMN,
    )

    # ===================== 3. FEATURE EXTRACTION =====================
    extracted_data, extracted_feature_columns = feature_extraction_step(
        transformed_df=engineered_data
    )

    # ===================== 4. SPLIT =====================
    X_train, X_test, y_train, y_test = data_splitter_train_test_step(
        extracted_data,
        target_column=TARGET_COLUMN,
    )

    # ===================== 5. OUTLIER DETECTION =====================
    X_train_clean = outlier_detection_step(X_train, threshold=3, method="remove")
    y_train_aligned = align_labels_step(X_train_clean, y_train)

    # ===================== 6. SCALING =====================
    X_train_scaled, X_test_scaled, scaler_path, numeric_columns = scaling_step(
        X_train=X_train_clean, X_test=X_test, strategy="standard"
    )

    # ===================== 7. POWER TRANSFORM =====================
    X_train_transformed, X_test_transformed, transformer_path = power_transform_step(
        X_train=X_train_scaled, X_test=X_test_scaled, strategy="yeo-johnson"
    )

    # ===================== 8. TARGET ENCODING =====================
    if model_mode == "standard":
        y_train_final, y_test_final, target_encoder_path = target_encoding_step(
            y_train=y_train_aligned, y_test=y_test
        )
    else:
        y_train_final, y_test_final = y_train_aligned, y_test

    # ===================== 9. FEATURE SELECTION (MI, train only) =====================
    X_train_final, selected_features = mi_selection_step(
        X_train=X_train_transformed,
        y_train=y_train_final,
        top_k=15,
        reference_columns=extracted_feature_columns,
    )

    X_test_final = filter_test_features_step(
        X_test=X_test_transformed, selected_features=selected_features
    )

    manifest_path = save_inference_preprocessors_step(
        scaler_path=scaler_path,
        transformer_path=transformer_path,
        selected_features=selected_features,
        numeric_columns=numeric_columns,
    )

    # ===================== 10. MODEL BUILD + TRAIN =====================
    if model_mode == "standard":
        model = build_model_step(model_type=model_type, rf_max_depth=10)
        trained_model, run_id = train_model_step(
            model=model, X_train=X_train_final, y_train=y_train_final
        )
    elif model_mode == "hierarchical":
        stage1_model = build_model_step(
            model_type=model_type, rf_max_depth=10, id="build_stage1_model"
        )
        stage2_model = build_model_step(
            model_type=model_type, rf_max_depth=10, id="build_stage2_model"
        )
        trained_model, run_id = train_hierarchical_model_step(
            stage1_model=stage1_model,
            stage2_model=stage2_model,
            X_train=X_train_final,
            y_train=y_train_final,
        )
    else:
        raise ValueError(f"Unsupported model_mode: {model_mode}")

    # ===================== 11. EVALUATION =====================
    results = evaluate_model_step(
        model=trained_model, X_test=X_test_final, y_test=y_test_final, run_id=run_id
    )

    # ===================== 12. MODEL REGISTRATION =====================
    register_model_step(
        run_id=run_id,
        model_name=MODEL_NAME,
        metric_name=promotion_metric,
        metric_threshold=promotion_threshold,
        target_alias="champion",
    )

    return trained_model


if __name__ == "__main__":
    cbc_ml_pipeline(model_mode="hierarchical", model_type="rf")

# model_mode = 'standard'
# but hierarchical better becasue imbalance data


# python -c "import mlflow; print(mlflow.__version__)"

# python -m pipelines.train_pipeline