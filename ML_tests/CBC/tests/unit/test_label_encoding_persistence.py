import pandas as pd
import pytest

from src.feature_engineering import LabelEncodingStrategy, FeatureEngineer


def test_each_column_gets_its_own_independent_encoder():
    """Regression test for the original bug where a single shared
    LabelEncoder instance was reused (and silently overwritten) across
    multiple columns, making per-column mappings unrecoverable at
    inference time."""
    df = pd.DataFrame({
        "sex": ["M", "F", "M", "F"],
        "blood_type": ["A", "B", "AB", "O"],
    })

    strategy = LabelEncodingStrategy(features=["sex", "blood_type"])
    engineer = FeatureEngineer(strategy)
    engineer.apply_feature_engineering(df)

    assert set(strategy.encoders.keys()) == {"sex", "blood_type"}
    assert list(strategy.encoders["sex"].classes_) == ["F", "M"]
    assert list(strategy.encoders["blood_type"].classes_) == ["A", "AB", "B", "O"]


def test_transform_uses_saved_mapping_without_refitting(tmp_path):
    """The encoders saved during training must be reusable via transform()
    at inference time without calling fit_transform() again."""
    df_train = pd.DataFrame({"sex": ["M", "F", "M", "F"]})
    strategy = LabelEncodingStrategy(features=["sex"])
    engineer = FeatureEngineer(strategy)
    engineer.apply_feature_engineering(df_train)

    encoders_path = tmp_path / "label_encoders.joblib"
    strategy.save_encoders(str(encoders_path))

    loaded_strategy = LabelEncodingStrategy.load_encoders(
        features=["sex"], path=str(encoders_path)
    )

    df_new = pd.DataFrame({"sex": ["F", "M"]})
    transformed = loaded_strategy.transform(df_new)

    original_encoder = strategy.encoders["sex"]
    expected = original_encoder.transform(["F", "M"])

    assert list(transformed["sex"]) == list(expected)


def test_transform_raises_on_unseen_category():
    """A category never seen during training must raise clearly at
    inference time, not silently produce a wrong/undefined encoding."""
    df_train = pd.DataFrame({"sex": ["M", "F"]})
    strategy = LabelEncodingStrategy(features=["sex"])
    engineer = FeatureEngineer(strategy)
    engineer.apply_feature_engineering(df_train)

    df_new = pd.DataFrame({"sex": ["Unknown"]})

    with pytest.raises(ValueError):
        strategy.transform(df_new)