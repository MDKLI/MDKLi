import inspect

import pandas as pd
import pytest

from src.data_splitter import DataSplitter, SimpleTrainTestSplitStrategy
from steps.data_splitter_step import data_splitter_train_test_step


def _make_sample_df(n_per_class=10):
    data = []
    for cls in ["Healthy", "Iron deficiency anemia", "Leukemia"]:
        for _ in range(n_per_class):
            data.append({"WBC": 6.0, "RBC": 5.0, "Diagnosis": cls})
    return pd.DataFrame(data)


def test_split_data_signature_has_no_target_column2():
    """Guards against the removed target_column2 parameter being
    reintroduced by accident in a future edit."""
    sig = inspect.signature(SimpleTrainTestSplitStrategy.split_data)
    params = list(sig.parameters.keys())

    assert "target_column2" not in params
    assert "target_column" in params


def test_data_splitter_split_rejects_extra_argument():
    """A caller passing the old target_column2-style extra argument should
    fail loudly with a clear TypeError, not silently ignore it."""
    df = _make_sample_df()
    strategy = SimpleTrainTestSplitStrategy(test_size=0.3, random_state=42)
    splitter = DataSplitter(strategy=strategy)

    with pytest.raises(TypeError):
        splitter.split(df, "Diagnosis", "some_other_column")


def test_data_splitter_train_test_step_produces_matching_shapes():
    df = _make_sample_df()

    X_train, X_test, y_train, y_test = data_splitter_train_test_step.entrypoint(
        df=df, target_column="Diagnosis", test_size=0.3, random_state=42
    )

    assert len(X_train) + len(X_test) == len(df)
    assert len(y_train) == len(X_train)
    assert len(y_test) == len(X_test)
    assert "Diagnosis" not in X_train.columns
    assert "Diagnosis" not in X_test.columns