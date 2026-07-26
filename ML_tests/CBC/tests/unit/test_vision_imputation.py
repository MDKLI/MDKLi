import pytest

from app.vision import imputation


def test_impute_fills_only_none_optional_fields(monkeypatch):
    monkeypatch.setattr(
        imputation, "_load_medians", lambda path=imputation.MEDIANS_PATH: {"PDW": 16.0, "PCT": 0.22}
    )

    values = {
        "WBC": 7.4, "RBC": 5.27, "HGB": 13.9, "HCT": 43.8,
        "MCV": 88.6, "MCH": 29.4, "MCHC": 33.4, "PLT": 248,
        "PDW": None, "PCT": None,
        "LYMp": 32.0, "NEUTp": 62.0, "LYMn": 2.4, "NEUTn": 4.6,
    }

    imputed, warnings = imputation.impute_missing_optional_fields(values)

    assert imputed["PDW"] == 16.0
    assert imputed["PCT"] == 0.22
    assert len(warnings) == 2
    assert any("PDW" in w for w in warnings)
    assert any("PCT" in w for w in warnings)


def test_impute_does_not_overwrite_present_values(monkeypatch):
    monkeypatch.setattr(
        imputation, "_load_medians", lambda path=imputation.MEDIANS_PATH: {"PDW": 16.0, "PCT": 0.22}
    )

    values = {"PDW": None, "PCT": 12.0}
    imputed, warnings = imputation.impute_missing_optional_fields(values)

    assert imputed["PDW"] == 16.0
    assert imputed["PCT"] == 12.0
    assert len(warnings) == 1


def test_impute_leaves_non_optional_missing_fields_untouched(monkeypatch):
    monkeypatch.setattr(
        imputation, "_load_medians", lambda path=imputation.MEDIANS_PATH: {"PDW": 16.0, "PCT": 0.22}
    )

    values = {"WBC": None, "PDW": None}
    imputed, warnings = imputation.impute_missing_optional_fields(values)

    assert imputed["WBC"] is None
    assert imputed["PDW"] == 16.0


def test_load_medians_raises_when_file_missing(tmp_path):
    missing_path = str(tmp_path / "does_not_exist.json")
    with pytest.raises(FileNotFoundError):
        imputation._load_medians(path=missing_path)
