import json

import pytest

from app.vision.result_parser import parse_cbc_extraction


def _valid_response_dict():
    return {
        "WBC": 7.4, "RBC": 5.27, "HGB": 13.9, "HCT": 43.8,
        "MCV": 88.6, "MCH": 29.4, "MCHC": 33.4, "PLT": 248,
        "PDW": 12.1, "PCT": 0.25,
        "LYMp": 32.0, "NEUTp": 62.0, "LYMn": 2.4, "NEUTn": 4.6,
    }


def test_parses_valid_json():
    raw = json.dumps(_valid_response_dict())
    result = parse_cbc_extraction(raw)
    assert result["WBC"] == 7.4


def test_strips_markdown_fences():
    raw = "```json\n" + json.dumps(_valid_response_dict()) + "\n```"
    result = parse_cbc_extraction(raw)
    assert result["HGB"] == 13.9


def test_raises_on_invalid_json():
    with pytest.raises(ValueError, match="not valid JSON"):
        parse_cbc_extraction("this is not json {")


def test_raises_on_missing_required_field():
    data = _valid_response_dict()
    del data["WBC"]
    with pytest.raises(ValueError, match="missing required fields"):
        parse_cbc_extraction(json.dumps(data))


def test_raises_on_null_required_field():
    data = _valid_response_dict()
    data["WBC"] = None
    with pytest.raises(ValueError, match="could not read these required fields"):
        parse_cbc_extraction(json.dumps(data))


def test_allows_null_optional_field():
    data = _valid_response_dict()
    data["PDW"] = None
    data["PCT"] = None

    result = parse_cbc_extraction(json.dumps(data))

    assert result["PDW"] is None
    assert result["PCT"] is None
    assert result["WBC"] == 7.4


def test_raises_on_non_numeric_value():
    data = _valid_response_dict()
    data["WBC"] = "seven point four"
    with pytest.raises(ValueError, match="Non-numeric"):
        parse_cbc_extraction(json.dumps(data))
