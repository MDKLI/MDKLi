import inspect

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

from src.hierarchical_classifier import HierarchicalClassifier


def _make_training_data():
    rng = np.random.default_rng(42)
    n = 100
    X = pd.DataFrame({
        "feature_a": rng.normal(size=n),
        "feature_b": rng.normal(size=n),
    })

    labels = ["Healthy"] * 60 + ["Iron deficiency anemia"] * 30 + ["Leukemia"] * 10
    y = pd.Series(labels, name="Diagnosis")

    rare_mask = y.isin(["Leukemia"])
    y_stage1 = y.where(~rare_mask, "Others")
    y_stage2 = y[rare_mask]
    X_rare = X[rare_mask]

    return X, y_stage1, X_rare, y_stage2


def test_fit_signature_is_custom_four_argument_form():
    """Regression test: HierarchicalClassifier does NOT follow the
    standard sklearn fit(X, y) signature. Anything that builds/trains it
    (a single .fit(X, y) call, GridSearchCV, cross_val_score, generic
    MLflow autologging) must account for this custom signature
    explicitly instead of assuming standard sklearn behavior."""
    sig = inspect.signature(HierarchicalClassifier.fit)
    params = list(sig.parameters.keys())

    assert params == ["self", "X", "y_stage1", "X_rare", "y_stage2"]


def test_fit_and_predict_route_rare_classes_through_stage2():
    X, y_stage1, X_rare, y_stage2 = _make_training_data()

    stage1_model = RandomForestClassifier(n_estimators=50, random_state=42)
    stage2_model = RandomForestClassifier(n_estimators=50, random_state=42)

    model = HierarchicalClassifier(stage1_model=stage1_model, stage2_model=stage2_model)
    model.fit(X, y_stage1, X_rare, y_stage2)

    preds = model.predict(X)

    assert len(preds) == len(X)
    assert "Others" not in preds


def test_predict_proba_returns_valid_probability_matrix():
    X, y_stage1, X_rare, y_stage2 = _make_training_data()

    stage1_model = RandomForestClassifier(n_estimators=50, random_state=42)
    stage2_model = RandomForestClassifier(n_estimators=50, random_state=42)

    model = HierarchicalClassifier(stage1_model=stage1_model, stage2_model=stage2_model)
    model.fit(X, y_stage1, X_rare, y_stage2)

    proba = model.predict_proba(X)

    assert proba.shape[0] == len(X)
    np.testing.assert_allclose(proba.sum(axis=1), 1.0, atol=1e-6)


def test_classes_property_excludes_others_placeholder():
    X, y_stage1, X_rare, y_stage2 = _make_training_data()

    stage1_model = RandomForestClassifier(n_estimators=50, random_state=42)
    stage2_model = RandomForestClassifier(n_estimators=50, random_state=42)

    model = HierarchicalClassifier(stage1_model=stage1_model, stage2_model=stage2_model)
    model.fit(X, y_stage1, X_rare, y_stage2)

    assert "Others" not in model.classes_
    assert "Leukemia" in model.classes_


# python -m pytest tests/unit/ -v
