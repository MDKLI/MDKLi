import json
import os

import pandas as pd

from centralized_logging.logger import get_logger
from pipelines.train_pipeline import DATA_PATH

logger = get_logger(__name__)

RAW_CBC_FIELDS = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC",
    "PLT", "PDW", "PCT", "LYMp", "NEUTp", "LYMn", "NEUTn",
]

OUTPUT_PATH = "artifacts/field_medians.json"


def main() -> None:
    logger.info(f"Loading raw dataset from: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)

    missing_cols = [c for c in RAW_CBC_FIELDS if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Raw dataset is missing expected columns: {missing_cols}")

    medians = {field: round(float(df[field].median()), 2) for field in RAW_CBC_FIELDS}

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(medians, f, indent=2)

    logger.info(f"Saved field medians to: {OUTPUT_PATH}")
    logger.info(f"Medians: {medians}")


if __name__ == "__main__":
    main()

# python -m scripts.compute_field_medians