import argparse
import json
import os

import joblib
import pandas as pd

from centralized_logging.logger import get_logger
from src.feature_extraction import FeatureExtractor, CBCFeatureExtractionStrategy

logger = get_logger(__name__)

MODEL_PATHS = {
    "standard": "artifacts/cbc_model.pkl",
    "hierarchical": "artifacts/cbc_hierarchical_model.pkl",
}

DEFAULT_MANIFEST_PATH = "artifacts/inference_manifest.json"

SAMPLE_INPUT = {
    "WBC": 7.4,
    "RBC": 5.27,
    "HGB": 13.9,
    "HCT": 43.8,
    "MCV": 88.6,
    "MCH": 29.4,
    "MCHC": 33.4,
    "PLT": 248,
    "PDW": 12.1,
    "PCT": 0.25,
    "LYMp": 32.0,
    "NEUTp": 62.0,
    "LYMn": 2.4,
    "NEUTn": 4.6,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a single CBC prediction outside of ZenML, for quick "
                    "manual testing. Applies the same feature extraction, "
                    "scaling, power transform, and feature selection recorded "
                    "in the training pipeline's inference manifest."
    )
    parser.add_argument(
        "--input-json",
        type=str,
        default=None,
        help="Path to a JSON file with raw CBC values "
             f"(keys: {list(SAMPLE_INPUT.keys())}). "
             "If omitted, a built-in sample reading is used.",
    )
    parser.add_argument(
        "--model-mode",
        choices=["standard", "hierarchical"],
        default="hierarchical",
        help="Which trained model artifact to load. Default: hierarchical.",
    )
    parser.add_argument(
        "--manifest-path",
        type=str,
        default=DEFAULT_MANIFEST_PATH,
        help=f"Path to the inference manifest. Default: {DEFAULT_MANIFEST_PATH}",
    )
    return parser.parse_args()


def load_raw_input(input_json_path: str | None) -> dict:
    if input_json_path is None:
        logger.info("No --input-json provided; using the built-in sample reading.")
        return SAMPLE_INPUT

    if not os.path.exists(input_json_path):
        raise FileNotFoundError(f"Input file not found: {input_json_path}")

    with open(input_json_path) as f:
        raw = json.load(f)

    missing = set(SAMPLE_INPUT.keys()) - set(raw.keys())
    if missing:
        raise ValueError(f"Input JSON is missing required CBC fields: {sorted(missing)}")

    return raw


def load_manifest(manifest_path: str) -> dict:
    if not os.path.exists(manifest_path):
        raise FileNotFoundError(
            f"Manifest not found at '{manifest_path}'. Run the training "
            "pipeline first to generate it."
        )

    with open(manifest_path) as f:
        manifest = json.load(f)

    required_keys = {"scaler_path", "transformer_path", "selected_features", "numeric_columns"}
    missing_keys = required_keys - set(manifest.keys())
    if missing_keys:
        raise ValueError(
            f"Manifest at '{manifest_path}' is missing keys: {missing_keys}. "
            "Re-run the training pipeline to regenerate it with the current schema."
        )

    return manifest


def load_model(model_mode: str):
    model_path = MODEL_PATHS[model_mode]
    if not os.path.exists(model_path):
        raise FileNotFoundError(
            f"Model artifact not found at '{model_path}'. "
            f"Ensure the training pipeline ran with model_mode='{model_mode}'."
        )
    return joblib.load(model_path)


def main() -> None:
    args = parse_args()

    raw_data = load_raw_input(args.input_json)
    manifest = load_manifest(args.manifest_path)
    model = load_model(args.model_mode)

    df_raw = pd.DataFrame([raw_data])
    logger.info(f"Raw input shape: {df_raw.shape}")

    extractor = FeatureExtractor(strategy=CBCFeatureExtractionStrategy())
    df_extracted = extractor.apply_feature_extraction(df_raw)
    logger.info(f"Shape after feature extraction: {df_extracted.shape}")

    scaler = joblib.load(manifest["scaler_path"])
    transformer = joblib.load(manifest["transformer_path"])
    numeric_cols = manifest["numeric_columns"]
    selected_features = manifest["selected_features"]

    missing_numeric = [c for c in numeric_cols if c not in df_extracted.columns]
    if missing_numeric:
        raise ValueError(
            f"Extracted features are missing columns the scaler/transformer "
            f"were fit on: {missing_numeric}"
        )

    df_extracted[numeric_cols] = scaler.transform(df_extracted[numeric_cols])
    df_extracted[numeric_cols] = transformer.transform(df_extracted[numeric_cols])

    missing_selected = [c for c in selected_features if c not in df_extracted.columns]
    if missing_selected:
        raise ValueError(f"Preprocessed data is missing required columns: {missing_selected}")

    df_final = df_extracted[selected_features]
    logger.info(f"Final model input shape: {df_final.shape}")

    prediction = model.predict(df_final)

    print("\n=== Prediction Result ===")
    print(f"Model mode : {args.model_mode}")
    print(f"Prediction : {prediction[0]}")


if __name__ == "__main__":
    main()

# python -m scripts.sample_predictor
# python -m scripts.sample_predictor --model-mode standard
# python -m scripts.sample_predictor --input-json my_patient.json --model-mode hierarchical