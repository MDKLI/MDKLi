import pandas as pd
from zenml import step


@step(enable_cache=False)
def dynamic_importer() -> str:

    data = {
        "WBC": 7.4,
        "RBC": 5.27,
        "HGB": 13.9,
        "HCT": 43.8,
        "MCV": 88.6,
        "MCH": 29.4,
        "MCHC": 33.4,
        "PLT": 248,
        "PDW": 12.1,
        "PCT": 0.25,
        "LYMp": 32.0,
        "NEUTp": 62.0,
        "LYMn": 2.4,
        "NEUTn": 4.6,
    }

    df = pd.DataFrame([data])

    return df.to_json(orient="split")

# python -m steps.deployment.dynamic_importer