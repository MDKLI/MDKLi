CBC_FIELDS = [
    "WBC", "RBC", "HGB", "HCT", "MCV", "MCH", "MCHC",
    "PLT", "PDW", "PCT", "LYMp", "NEUTp", "LYMn", "NEUTn",
]

FIELD_DESCRIPTIONS = {
    "WBC": "White blood cell count",
    "RBC": "Red blood cell count",
    "HGB": "Hemoglobin",
    "HCT": "Hematocrit",
    "MCV": "Mean corpuscular volume",
    "MCH": "Mean corpuscular hemoglobin",
    "MCHC": "Mean corpuscular hemoglobin concentration",
    "PLT": "Platelet count",
    "PDW": "Platelet distribution width",
    "PCT": "Plateletcrit",
    "LYMp": "Lymphocyte percentage",
    "NEUTp": "Neutrophil percentage",
    "LYMn": "Lymphocyte absolute count",
    "NEUTn": "Neutrophil absolute count",
}

EXTRACTION_SYSTEM_PROMPT = (
    "You are a data-extraction assistant reading a Complete Blood Count "
    "(CBC) lab report. Extract ONLY the numeric values explicitly printed "
    "on the report. Do not calculate, estimate, or infer any value that "
    "is not directly stated. Do not provide any diagnosis or interpretation."
)


def build_extraction_prompt() -> str:
    field_lines = "\n".join(f"- {field}: {FIELD_DESCRIPTIONS[field]}" for field in CBC_FIELDS)
    example_keys = ", ".join(f'"{f}": <number or null>' for f in CBC_FIELDS[:2])

    return (
        f"Extract the following CBC values from the attached report:\n\n"
        f"{field_lines}\n\n"
        "Respond with ONLY a single JSON object containing exactly these "
        f"keys, e.g. {{{example_keys}, ...}}. Use plain numbers with no "
        "units, no markdown code fences, and no extra text before or after "
        "the JSON.\n\n"
        "If a value is not visible on the report, use null for that key "
        "rather than guessing or estimating."
    )


def build_retry_prompt(previous_response: str, error: str) -> str:
    return (
        "Your previous response could not be parsed as valid JSON with the "
        f"required fields. Error: {error}\n\n"
        f"Previous response:\n{previous_response}\n\n"
        "Please respond again with ONLY a valid JSON object containing "
        f"exactly these keys: {', '.join(CBC_FIELDS)}. No markdown, no "
        "extra text - numeric values or null only."
    )
