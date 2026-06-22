import pandas as pd
from zenml import step


@step
def dynamic_importer() -> str:
    data = {
        'gfr': [-0.176036],
        'kidney_function_score': [0.002904],
        'gfr_bun_ratio': [0.158833],
        'cluster': [0.734180],
        'urine_ph': [-0.370931],
        'inflammation_score': [-0.720636],
        'c3_c4': [0.704711],
        'c3_c4_norm': [0.704711],
        'bun': [-0.351793],
        'ana': [-0.654654],
    }

    df = pd.DataFrame(data)

    json_data = df.to_json(orient="split")

    return json_data