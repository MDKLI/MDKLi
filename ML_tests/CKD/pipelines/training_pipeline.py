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


@pipeline(
    model=Model(
        name="CKD Prediction Model"
    )
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
        features=[]
    )

    # ===================== 3. FEATURE EXTRACTION =====================
    extracted_data = feature_extraction_step(
        transformed_df=engineered_data
    )

    # ===================== 4. SCALING =====================
    scaled_data = scaling_step(
        df=extracted_data,
        strategy="standard"
    )

    # ===================== 5. POWER TRANSFORM =====================
    transformed_data = power_transform_step(
        df=scaled_data,
        strategy="yeo-johnson"
    )

    # ===================== 6. OUTLIER HANDLING =====================
    columns = [
        'gfr', 'cluster', 'c3_c4', 'urine_ph',
        'bun', 'ana', 'hematuria',
        'serum_creatinine', 'serum_calcium'
    ]

    X_clean = transformed_data

    for col in columns:
        X_clean = outlier_detection_step(
            X_clean,
            column_name=col
        )

    # ===================== 7. SPLIT =====================
    X_train, X_test, y_train, y_test = data_splitter_train_test_step(
        X_clean,
        target_column1="ckd_stage",
        target_column2="ckd_pred"
    )

    # ===================== 8. FEATURE SELECTION (MI) =====================
    X_train_final = mi_selection_step(
        X=X_train,
        y=y_train,
        top_k=10
    )

    X_test_final = filter_test_features_step(
        X_test=X_test,
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