import pytest
from pydantic import ValidationError

from app.schemas import CBCRawValues


def _valid_payload():
    return {
        "WBC": 7.4, "RBC": 5.27, "HGB": 13.9, "HCT": 43.8,
        "MCV": 88.6, "MCH": 29.4, "MCHC": 33.4, "PLT": 248,
        "PDW": 12.1, "PCT": 0.25,
        "LYMp": 32.0, "NEUTp": 62.0, "LYMn": 2.4, "NEUTn": 4.6,
    }


def test_valid_payload_parses_successfully():
    values = CBCRawValues(**_valid_payload())
    assert values.WBC == 7.4


def test_negative_value_is_rejected():
    payload = _valid_payload()
    payload["WBC"] = -1.0

    with pytest.raises(ValidationError):
        CBCRawValues(**payload)


def test_missing_required_field_is_rejected():
    payload = _valid_payload()
    del payload["HGB"]

    with pytest.raises(ValidationError):
        CBCRawValues(**payload)
