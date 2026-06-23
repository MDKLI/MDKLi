import json
import logging

import numpy as np
import pandas as pd
from zenml import step

logger = logging.getLogger(__name__)


@step(enable_cache=False)
def predictor(
    model,
    input_data: str,
) -> np.ndarray:

    data = json.loads(input_data)

    columns = data.pop("columns", None)
    data.pop("index", None)

    expected_columns = [
        'gfr',
        'kidney_function_score',
        'gfr_bun_ratio',
        'cluster',
        'urine_ph',
        'inflammation_score',
        'c3_c4',
        'c3_c4_norm',
        'bun',
        'ana',
    ]

    df = pd.DataFrame(data["data"], columns=columns if columns else expected_columns)
    df = df[expected_columns]

    logger.info(f"Running prediction on input shape: {df.shape}")

    prediction = model.predict(df)

    logger.info(f"Prediction result: {prediction}")

    return prediction