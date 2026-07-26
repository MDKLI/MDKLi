import json
from pathlib import Path

DEFAULT_RARE_CLASSES = [
    "Leukemia with thrombocytopenia",
    "Macrocytic anemia",
    "Leukemia",
    "Other microcytic anemia",
    "Thrombocytopenia",
]

RARE_CLASSES_PATH = Path("artifacts/rare_classes.json")


def save_rare_classes(rare_classes=None, path: Path = RARE_CLASSES_PATH):
    rare_classes = rare_classes or DEFAULT_RARE_CLASSES
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(rare_classes, f, indent=2)
    return rare_classes


def load_rare_classes(path: Path = RARE_CLASSES_PATH):
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return DEFAULT_RARE_CLASSES


RARE_CLASSES = load_rare_classes()


def make_stage1_labels(y):
    return y.apply(lambda label: "Others" if label in RARE_CLASSES else label)


def make_stage2_labels(y):
    mask = y.isin(RARE_CLASSES)
    return y[mask], mask
