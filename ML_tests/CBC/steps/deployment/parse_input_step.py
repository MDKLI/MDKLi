import json

import pandas as pd
from zenml import step


@step(enable_cache=False)
def parse_input_step(input_data: str) -> pd.DataFrame:
    """Converts the split-orient JSON payload back into a DataFrame."""
    payload = json.loads(input_data)
    return pd.DataFrame(payload["data"], columns=payload["columns"])

# python -m steps.deployment.parse_input_step