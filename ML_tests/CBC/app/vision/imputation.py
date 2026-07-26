import json
import os
from typing import Dict, List, Optional, Tuple

from centralized_logging.logger import get_logger

logger = get_logger(__name__)

# Fields some CBC analyzers/reports omit entirely. A missing value for
# these is imputed from the training data's per-field median rather than
# rejecting the whole request. Any OTHER field that's missing/unreadable
# still fails the request - imputing a core measurement (e.g. WBC, HGB)
# would be medically misleading, not just "less precise".
OPTIONAL_FIELDS = {"PDW", "PCT"}

MEDIANS_PATH = "artifacts/field_medians.json"


def _load_medians(path: str = MEDIANS_PATH) -> Dict[str, float]:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Field medians not found at '{path}'. Run "
            "`python -m scripts.compute_field_medians` once after training."
        )
    with open(path) as f:
        return json.load(f)


def impute_missing_optional_fields(
    values: Dict[str, Optional[float]],
) -> Tuple[Dict[str, Optional[float]], List[str]]:
    """Fills in OPTIONAL_FIELDS that came back as None from the vision
    model, using the training data's median for that field.

    Fields NOT in OPTIONAL_FIELDS are left untouched even if None - those
    represent an unreadable required value and must still fail downstream
    validation rather than being silently guessed.
    """
    warnings: List[str] = []
    medians = _load_medians()

    imputed = dict(values)

    for field in OPTIONAL_FIELDS:
        if imputed.get(field) is None and field in medians:
            imputed[field] = medians[field]
            warnings.append(
                f"{field} was not present on the report; used the training "
                f"data median ({medians[field]}) as an approximation. "
                "This reduces the reliability of the prediction."
            )
            logger.info(f"Imputed missing optional field '{field}' with median {medians[field]}")

    return imputed, warnings