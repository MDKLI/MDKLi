import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _valid_payload():
    return {
        "WBC": 7.4, "RBC": 5.27, "HGB": 13.9, "HCT": 43.8,
        "MCV": 88.6, "MCH": 29.4, "MCHC": 33.4, "PLT": 248,
        "PDW": 12.1, "PCT": 0.25,
        "LYMp": 32.0, "NEUTp": 62.0, "LYMn": 2.4, "NEUTn": 4.6,
    }


def test_health_endpoint_reports_model_loaded(client):
    response = client.get("/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["model_loaded"] is True


def test_predict_from_values_returns_diagnosis(client):
    response = client.post("/v1/predict/from-values", json=_valid_payload())

    assert response.status_code == 200
    body = response.json()
    assert "diagnosis" in body
    assert isinstance(body["diagnosis"], str)
    assert body["model_mode"] in ("standard", "hierarchical")


def test_predict_from_values_rejects_negative_value(client):
    payload = _valid_payload()
    payload["WBC"] = -1.0

    response = client.post("/v1/predict/from-values", json=payload)

    assert response.status_code == 422
