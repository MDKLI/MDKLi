import json
import re
from typing import Dict, Optional

from app.vision.imputation import OPTIONAL_FIELDS
from app.vision.prompt_templates import CBC_FIELDS


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def parse_cbc_extraction(raw_text: str) -> Dict[str, Optional[float]]:
    """Parses the vision model's response into a dict of CBC raw values.

    OPTIONAL_FIELDS (e.g. PDW, PCT) are allowed to be null - some CBC
    analyzers don't report them - and are returned as None for the caller
    to impute (see app.vision.imputation). Any other field being null
    still raises, since it represents a required value the model
    genuinely couldn't read.

    Raises ValueError with a specific, actionable message on any failure,
    so the caller can decide whether to retry with a reinforced prompt.
    """
    cleaned = _strip_markdown_fences(raw_text)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"Vision response is not valid JSON: {e}") from e

    if not isinstance(data, dict):
        raise ValueError(f"Expected a JSON object, got {type(data).__name__}")

    missing = [f for f in CBC_FIELDS if f not in data]
    if missing:
        raise ValueError(f"Vision response is missing required fields: {missing}")

    required_null_fields = [
        f for f in CBC_FIELDS if data.get(f) is None and f not in OPTIONAL_FIELDS
    ]
    if required_null_fields:
        raise ValueError(
            f"Vision model could not read these required fields from the report: "
            f"{required_null_fields}. Try a clearer image or a higher-resolution scan."
        )

    non_numeric = [
        f for f in CBC_FIELDS
        if data.get(f) is not None and not isinstance(data[f], (int, float))
    ]
    if non_numeric:
        raise ValueError(f"Non-numeric values returned for fields: {non_numeric}")

    return {
        field: (float(data[field]) if data.get(field) is not None else None)
        for field in CBC_FIELDS
    }