from app.vision.validators import validate_extracted_values


def _valid_values():
    return {
        "WBC": 7.4, "RBC": 5.27, "HGB": 13.9, "HCT": 43.8,
        "MCV": 88.6, "MCH": 29.4, "MCHC": 33.4, "PLT": 248,
        "PDW": 12.1, "PCT": 0.25,
        "LYMp": 32.0, "NEUTp": 62.0, "LYMn": 2.4, "NEUTn": 4.6,
    }


def test_no_warnings_for_plausible_values():
    warnings = validate_extracted_values(_valid_values())
    assert warnings == []


def test_warns_on_value_far_outside_plausible_range():
    values = _valid_values()
    values["WBC"] = 740.0

    warnings = validate_extracted_values(values)

    assert any("WBC" in w for w in warnings)


def test_warns_on_negative_value():
    values = _valid_values()
    values["HGB"] = -5.0

    warnings = validate_extracted_values(values)

    assert any("HGB" in w and "negative" in w for w in warnings)


def test_ignores_none_values_without_raising():
    values = _valid_values()
    values["PDW"] = None

    warnings = validate_extracted_values(values)

    assert isinstance(warnings, list)
