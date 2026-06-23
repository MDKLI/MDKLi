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
        try:
            logger.info(f"Loading model from {self.path}")
            model = joblib.load(self.path)
            logger.info("Model loaded successfully")
            return model
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise RuntimeError(f"Failed to load model: {e}") from e