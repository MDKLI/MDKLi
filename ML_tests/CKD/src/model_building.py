import logging
from abc import ABC, abstractmethod

from sklearn.base import BaseEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier


# ===================== LOGGING =====================
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# ===================== STRATEGY =====================
class ModelStrategy(ABC):
    @abstractmethod
    def build(self) -> BaseEstimator:
        pass


# ===================== LOGISTIC REGRESSION =====================
class LogisticRegressionStrategy(ModelStrategy):
    def __init__(self, max_iter: int = 1000, C: float = 1.0):
        self.max_iter = max_iter
        self.C = C

    def build(self) -> BaseEstimator:
        logger.info("Building Logistic Regression model...")
        return LogisticRegression(
            max_iter=self.max_iter,
            C=self.C
        )


# ===================== RANDOM FOREST =====================
class RandomForestStrategy(ModelStrategy):
    def __init__(self, n_estimators: int = 100, max_depth: int = None):
        self.n_estimators = n_estimators
        self.max_depth = max_depth

    def build(self) -> BaseEstimator:
        logger.info("Building Random Forest model...")
        return RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            random_state=42
        )


# ===================== CONTEXT =====================
class ModelBuilder:
    def __init__(self, strategy: ModelStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: ModelStrategy):
        logger.info("Switching model strategy...")
        self._strategy = strategy

    def build_model(self) -> BaseEstimator:
        logger.info("Creating model from strategy...")
        return self._strategy.build()


# ===================== MAIN =====================
if __name__ == "__main__":

    logger.info("Testing Model Builder...")

    # Logistic Regression
    builder = ModelBuilder(
        LogisticRegressionStrategy(max_iter=2000, C=0.5)
    )

    model = builder.build_model()
    logger.info(f"Built model: {model}")

    # Switch to Random Forest
    builder.set_strategy(
        RandomForestStrategy(n_estimators=200, max_depth=10)
    )

    model = builder.build_model()
    logger.info(f"Built model: {model}")