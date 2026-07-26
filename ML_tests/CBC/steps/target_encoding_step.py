import os
from typing import Tuple

import joblib
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from zenml import step

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


@step(enable_cache=False)
def target_encoding_step(
    y_train: pd.Series,
    y_test: pd.Series,
) -> Tuple[pd.Series, pd.Series, str]:
    """Label-encodes the target, fitting on y_train only.

    Used only in "standard" training mode. HierarchicalClassifier needs
    the original string labels and must skip this step entirely.
    """
    encoder = LabelEncoder()
    y_train_encoded = pd.Series(
        encoder.fit_transform(y_train.astype(str)), index=y_train.index, name=y_train.name
    )

    unseen = set(y_test.astype(str)) - set(encoder.classes_)
    if unseen:
        raise ValueError(f"y_test contains labels not seen in y_train: {unseen}")

    y_test_encoded = pd.Series(
        encoder.transform(y_test.astype(str)), index=y_test.index, name=y_test.name
    )

    artifacts_dir = "artifacts"
    os.makedirs(artifacts_dir, exist_ok=True)
    encoder_path = os.path.join(artifacts_dir, "target_label_encoder.joblib")
    joblib.dump(encoder, encoder_path)

    logger.info(f"Target classes: {dict(zip(encoder.classes_, range(len(encoder.classes_))))}")

    return y_train_encoded, y_test_encoded, encoder_path