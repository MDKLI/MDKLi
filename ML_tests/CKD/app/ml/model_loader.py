import logging
import joblib

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


class ModelLoader:
    def __init__(self, path: str):
        self.path = path

    def load_model(self):
        logger.info(f"Loading model from {self.path}")
        model = joblib.load(self.path)
        logger.info("Model loaded successfully")
        return model