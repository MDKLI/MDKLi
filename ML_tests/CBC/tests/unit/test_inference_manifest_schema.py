import json

import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.preprocessing import StandardScaler, PowerTransformer

from steps.save_inference_preprocessors_step import save_inference_preprocessors_step
from steps.deployment.apply_inference_preprocessing_step import apply_inference_preprocessing_step


def _make_fitted_scaler_and_transformer(tmp_path, columns):
    rng = np.random.default_rng(0)
    X = pd.DataFrame(rng.normal(loc=10, scale=2, size=(50, len(columns))), columns=columns)

    scaler = StandardScaler().fit(X)
    scaler_path = tmp_path / "scaler.joblib"
    joblib.dump(scaler, scaler_path)

    transformer = PowerTransformer(method="yeo-johnson").fit(scaler.transform(X))
    transformer_path = tmp_path / "transformer.joblib"
    joblib.dump(transformer, transformer_path)

    return str(scaler_path), str(transformer_path)


def test_manifest_contains_numeric_columns_key(tmp_path):
    """Regression test: the manifest must record the exact fitted numeric
    column list/order, not rely on re-inferring dtypes at inference time -
    the latter caused a feature-mismatch failure against the fitted
    scaler/transformer in production."""
    columns = ["WBC", "RBC", "HGB"]
    scaler_path, transformer_path = _make_fitted_scaler_and_transformer(tmp_path, columns)

    manifest_path = save_inference_preprocessors_step.entrypoint(
        scaler_path=scaler_path,
        transformer_path=transformer_path,
        selected_features=["WBC", "HGB"],
        numeric_columns=columns,
        manifest_path=str(tmp_path / "manifest.json"),
    )

    with open(manifest_path) as f:
        manifest = json.load(f)

    assert manifest["numeric_columns"] == columns
    assert manifest["selected_features"] == ["WBC", "HGB"]


def test_apply_inference_preprocessing_rejects_manifest_missing_keys(tmp_path):
    """An old-schema manifest (missing numeric_columns) must fail with a
    clear, actionable error instead of a raw KeyError deep in the step."""
    incomplete_manifest = {"scaler_path": "x", "transformer_path": "y"}
    manifest_path = tmp_path / "bad_manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(incomplete_manifest, f)

    df = pd.DataFrame({"WBC": [5.0]})

    with pytest.raises(ValueError, match="missing keys"):
        apply_inference_preprocessing_step.entrypoint(
            df=df, manifest_path=str(manifest_path)
        )


def test_apply_inference_preprocessing_end_to_end(tmp_path):
    columns = ["WBC", "RBC", "HGB"]
    scaler_path, transformer_path = _make_fitted_scaler_and_transformer(tmp_path, columns)

    manifest = {
        "scaler_path": scaler_path,
        "transformer_path": transformer_path,
        "selected_features": ["WBC", "HGB"],
        "numeric_columns": columns,
    }
    manifest_path = tmp_path / "manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f)

    df_new = pd.DataFrame({"WBC": [9.5], "RBC": [4.8], "HGB": [13.2]})

    result = apply_inference_preprocessing_step.entrypoint(
        df=df_new, manifest_path=str(manifest_path)
    )

    assert list(result.columns) == ["WBC", "HGB"]
    assert result.shape[0] == 1