from zenml import pipeline, Model

from steps.data_ingestion_step import data_ingestion_step
from steps.feature_engineering_step import feature_engineering_step
from steps.feature_extraction_step import feature_extraction_step
from steps.scaling_step import scaling_step
from steps.power_transform_step import power_transform_step
from steps.outlier_detection_step import outlier_detection_step
from steps.data_splitter_step import data_splitter_train_test_step
from steps.model_building_step import build_model_step
from steps.train_model import train_model_step
from steps.model_evaluator_step import evaluate_model_step
from steps.mutual_information_step import mi_selection_step, filter_test_features_step
from steps.save_inference_preprocessors_step import save_inference_preprocessors_step


@pipeline(
    model=Model(name="CKD Prediction Model"),
    enable_cache=False
)
def ckd_ml_pipeline():

    # ===================== 1. DATA INGESTION =====================
    raw_data = data_ingestion_step(
        file_path="extracted_data/updated_ckd_dataset_with_stages.csv"
    )

    # ===================== 2. FEATURE ENGINEERING =====================
    engineered_data = feature_engineering_step(
        raw_data,
        strategy="onehot_encoding",
        drop_columns=["ckd_pred_No CKD", "ckd_pred_Yes CKD"],
    )

    # ===================== 3. FEATURE EXTRACTION =====================
    extracted_data = feature_extraction_step(
        transformed_df=engineered_data
    )

    # ===================== 4. SPLIT =====================
    X_train, X_test, y_train, y_test = data_splitter_train_test_step(
        extracted_data,
        target_column1="ckd_stage",
        target_column2="ckd_pred"
    )

    # ===================== 5. OUTLIER DETECTION (train only) =====================
    columns = [
        'gfr', 'cluster', 'c3_c4', 'urine_ph',
        'bun', 'ana', 'hematuria',
        'serum_creatinine', 'serum_calcium'
    ]

    X_train_clean = X_train
    for col in columns:
        X_train_clean = outlier_detection_step(
            X_train_clean,
            column_name=col
        )

    # ===================== 6. SCALING (fit on train) =====================
    X_train_scaled, X_test_scaled = scaling_step(
        X_train=X_train_clean,
        X_test=X_test,
        strategy="standard"
    )

    # ===================== 7. POWER TRANSFORM (fit on train) =====================
    X_train_transformed, X_test_transformed = power_transform_step(
        X_train=X_train_scaled,
        X_test=X_test_scaled,
        strategy="yeo-johnson"
    )

    # ===================== 8. FEATURE SELECTION (MI) =====================
    X_train_final = mi_selection_step(
        X=X_train_transformed,
        y=y_train,
        top_k=10
    )

    save_inference_preprocessors_step(
        X_train_selected=X_train_final
    )

    X_test_final = filter_test_features_step(
        X_test=X_test_transformed,
        X_train_selected=X_train_final
    )

    # ===================== 9. MODEL BUILD =====================
    model = build_model_step(
        model_type="rf",
        rf_max_depth=10
    )

    # ===================== 10. TRAIN =====================
    trained_model = train_model_step(
        model=model,
        X_train=X_train_final,
        y_train=y_train
    )

    # ===================== 11. EVALUATION =====================
    results = evaluate_model_step(
        model=trained_model,
        X_test=X_test_final,
        y_test=y_test
    )

    return trained_model