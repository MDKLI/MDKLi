import logging
from abc import ABC, abstractmethod
from typing import Dict, Any

from sklearn.metrics import accuracy_score, f1_score, classification_report


# ===================== LOGGER =====================
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)


# ===================== STRATEGY =====================
class EvaluationStrategy(ABC):
    @abstractmethod
    def evaluate(self, model, X_test, y_test) -> Dict[str, Any]:
        pass


# ===================== CLASSIFICATION EVAL =====================
class ClassificationEvaluationStrategy(EvaluationStrategy):
    def __init__(self, average: str = "weighted"):
        self.average = average

    def evaluate(self, model, X_test, y_test) -> Dict[str, Any]:
        logger.info("Evaluating classification model...")

        preds = model.predict(X_test)

        # ===================== METRICS =====================
        acc = accuracy_score(y_test, preds)
        f1 = f1_score(y_test, preds, average=self.average)

        report = classification_report(y_test, preds)

        # ===================== LOGGING =====================
        logger.info(f"Accuracy: {acc:.4f}")
        logger.info(f"F1-score ({self.average}): {f1:.4f}")

        return {
            "accuracy": acc,
            "f1_score": f1,
            "classification_report": report
        }


# ===================== CONTEXT =====================
class ModelEvaluator:
    def __init__(self, strategy: EvaluationStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: EvaluationStrategy):
        logger.info("Switching evaluation strategy...")
        self._strategy = strategy

    def evaluate_model(self, model, X_test, y_test):
        logger.info("Running evaluation pipeline...")
        return self._strategy.evaluate(model, X_test, y_test)


# ===================== MAIN =====================
if __name__ == "__main__":

    logger.info("Testing Evaluation Module...")

    # mock example (replace with real model)
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.datasets import load_iris
    from sklearn.model_selection import train_test_split

    # ===================== DATA =====================
    data = load_iris()
    X = data.data
    y = data.target

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42
    )

    # ===================== MODEL =====================
    model = RandomForestClassifier()
    model.fit(X_train, y_train)

    # ===================== EVALUATION =====================
    evaluator = ModelEvaluator(
        ClassificationEvaluationStrategy(average="weighted")
    )

    results = evaluator.evaluate_model(model, X_test, y_test)

    logger.info(f"Final Results: {results}")