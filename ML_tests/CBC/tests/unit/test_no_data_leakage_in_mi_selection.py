import inspect

import numpy as np
import pandas as pd

from steps.mutual_information_step import mi_selection_step


def test_mi_selection_step_requires_explicit_train_split():
    """Guards against reintroducing generic X/y parameters, which allowed
    the full (pre-split) dataset to be passed into feature selection and
    leak test-set information into the selected feature list."""
    sig = inspect.signature(mi_selection_step.entrypoint)
    params = list(sig.parameters.keys())

    assert "X_train" in params
    assert "y_train" in params
    assert "X" not in params
    assert "y" not in params


def test_mi_selection_step_selects_requested_subset_of_columns(tmp_path):
    rng = np.random.default_rng(42)
    X_train = pd.DataFrame({f"feature_{i}": rng.normal(size=100) for i in range(5)})
    y_train = pd.Series((X_train["feature_0"] > 0).astype(int), name="target")

    X_selected, selected_features = mi_selection_step.entrypoint(
        X_train=X_train,
        y_train=y_train,
        top_k=3,
        plot_dir=str(tmp_path / "mi_plots"),
    )

    assert len(selected_features) == 3
    assert set(X_selected.columns) == set(selected_features)
    assert X_selected.shape[0] == X_train.shape[0]


def test_mi_selection_accepts_string_labels_without_encoding(tmp_path):
    """Regression test: mutual_info_classif works fine with discrete string
    labels directly. MI selection must NOT require label-encoded integer
    targets, since the hierarchical training path uses original string
    diagnosis labels."""
    rng = np.random.default_rng(0)
    X_train = pd.DataFrame({
        "feature_a": rng.normal(size=60),
        "feature_b": rng.normal(size=60),
    })
    y_train = pd.Series(["Healthy", "Sick"] * 30, name="Diagnosis")

    X_selected, selected_features = mi_selection_step.entrypoint(
        X_train=X_train, y_train=y_train, top_k=2, plot_dir=str(tmp_path / "mi_plots2")
    )

    assert len(selected_features) == 2