from abc import ABC, abstractmethod

from sklearn.base import BaseEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.calibration import CalibratedClassifierCV

from centralized_logging.logger import get_logger

logger = get_logger()


class ModelStrategy(ABC):
    @abstractmethod
    def build(self) -> BaseEstimator:
        pass


class LogisticRegressionStrategy(ModelStrategy):
    def __init__(self, max_iter: int = 1000, C: float = 1.0, class_weight: str = "balanced"):
        self.max_iter = max_iter
        self.C = C
        self.class_weight = class_weight

    def build(self) -> BaseEstimator:
        logger.info("Building Logistic Regression model...")
        return LogisticRegression(
            max_iter=self.max_iter,
            C=self.C,
            class_weight=self.class_weight
        )


class RandomForestStrategy(ModelStrategy):
    def __init__(self, n_estimators: int = 100, max_depth: int = None, class_weight: str = "balanced"):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.class_weight = class_weight

    def build(self) -> BaseEstimator:
        logger.info("Building Random Forest model...")
        return RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            class_weight=self.class_weight,
            random_state=42
        )


class XGBoostStrategy(ModelStrategy):
    def __init__(self, n_estimators: int = 100, max_depth: int = 3, learning_rate: float = 0.1):
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate

    def build(self) -> BaseEstimator:
        logger.info("Building XGBoost model...")
        return XGBClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            eval_metric='logloss',
            random_state=42
        )


class CalibratedModelStrategy(ModelStrategy):
    def __init__(self, base_model: BaseEstimator, method: str = 'sigmoid'):
        self.base_model = base_model
        self.method = method

    def build(self) -> BaseEstimator:
        logger.info("Building Calibrated model...")
        try:
            return CalibratedClassifierCV(estimator=self.base_model, method=self.method, cv='prefit')
        except TypeError:
            from sklearn.frozen import FrozenEstimator
            return CalibratedClassifierCV(FrozenEstimator(self.base_model), method=self.method)


class ModelBuilder:
    def __init__(self, strategy: ModelStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: ModelStrategy):
        logger.info("Switching model strategy...")
        self._strategy = strategy

    def build_model(self) -> BaseEstimator:
        logger.info("Creating model from strategy...")
        return self._strategy.build()


if __name__ == "__main__":
    strategies = {
        "Logistic Regression": LogisticRegressionStrategy(max_iter=2000),
        "Random Forest": RandomForestStrategy(n_estimators=200, max_depth=10),
        "XGBoost": XGBoostStrategy(n_estimators=200, max_depth=5, learning_rate=0.05),
    }

    builder = ModelBuilder(strategy=None)

    for name, strategy in strategies.items():
        builder.set_strategy(strategy)
        model = builder.build_model()
        logger.info(f"{name} model built: {model}")


# python -m src.model_building
