from typing import Dict, List

# Deliberately much wider than
# src.feature_extraction.CBCFeatureExtractionStrategy.PHYSIOLOGICAL_RANGES:
# this layer's job is to catch gross vision-extraction errors (e.g. a
# misread decimal point or unit), not to apply the clinical/training
# range - that stricter filtering already happens downstream in feature
# extraction. Duplicating the strict range here would blur which layer
# flagged what.
SANITY_RANGES = {
    "WBC": (0.1, 200),
    "RBC": (0.1, 15),
    "HGB": (0.5, 30),
    "HCT": (1, 90),
    "MCV": (20, 200),
    "MCH": (2, 60),
    "MCHC": (5, 50),
    "PLT": (1, 2000),
    "PDW": (1, 40),
    "PCT": (0.001, 2),
    "LYMp": (0, 100),
    "NEUTp": (0, 100),
    "LYMn": (0, 50),
    "NEUTn": (0, 50),
}


def validate_extracted_values(values: Dict[str, float]) -> List[str]:
    """Flags values outside a broad sanity envelope, most often caused by
    the vision model misreading a decimal point or unit (e.g. 74.0 instead
    of 7.4). Returns warnings rather than raising: a borderline-abnormal
    but real reading should still reach the model, while a wildly
    implausible one should make the caller consider re-extracting from a
    clearer image."""
    warnings = []

    for field, (low, high) in SANITY_RANGES.items():
        value = values.get(field)
        if value is None:
            continue
        if value < 0:
            warnings.append(f"{field}={value} is negative, which is not physically possible.")
        elif not (low <= value <= high):
            warnings.append(
                f"{field}={value} is far outside a plausible range ({low}-{high}); "
                "check for a misread decimal point or unit."
            )

    return warnings