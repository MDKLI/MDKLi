from abc import ABC, abstractmethod
from typing import Dict, Any

from sklearn.metrics import (
    accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


class EvaluationStrategy(ABC):
    @abstractmethod
    def evaluate(self, model, X_test, y_test) -> Dict[str, Any]:
        pass


class ClassificationEvaluationStrategy(EvaluationStrategy):
    def __init__(self, average: str = "weighted"):
        self.average = average

    def evaluate(self, model, X_test, y_test) -> Dict[str, Any]:
        logger.info("Evaluating classification model...")

        preds = model.predict(X_test)
        accuracy = accuracy_score(y_test, preds)
        f1 = f1_score(y_test, preds, average=self.average)

        labels = sorted(set(y_test) | set(preds))
        precision_per_class, recall_per_class, f1_per_class, support_per_class = (
            precision_recall_fscore_support(y_test, preds, labels=labels, zero_division=0)
        )

        per_class_metrics = {
            str(label): {
                "precision": float(precision_per_class[i]),
                "recall": float(recall_per_class[i]),
                "f1_score": float(f1_per_class[i]),
                "support": int(support_per_class[i]),
            }
            for i, label in enumerate(labels)
        }

        return {
            "accuracy": accuracy,
            "f1_score": f1,
            "classification_report": classification_report(y_test, preds),
            "confusion_matrix": confusion_matrix(y_test, preds, labels=labels).tolist(),
            "labels": [str(label) for label in labels],
            "per_class_metrics": per_class_metrics,
        }


class ModelEvaluator:
    def __init__(self, strategy: EvaluationStrategy):
        self._strategy = strategy

    def set_strategy(self, strategy: EvaluationStrategy):
        logger.info("Switching evaluation strategy...")
        self._strategy = strategy

    def evaluate_model(self, model, X_test, y_test):
        logger.info("Running evaluation pipeline...")
        return self._strategy.evaluate(model, X_test, y_test)


if __name__ == "__main__":
    import pandas as pd
    from sklearn.model_selection import train_test_split

    from src.feature_engineering import FeatureEngineer, LabelEncodingStrategy
    from src.model_building import (
        ModelBuilder,
        LogisticRegressionStrategy,
        RandomForestStrategy,
        XGBoostStrategy,
    )

    file_id = "1YGB0V3H-2o3-2__8PA3XNOLWpqXEqgI6"
    url = f"https://drive.google.com/uc?id={file_id}"
    df = pd.read_csv(url)

    target_col = "Diagnosis"

    label_strategy = LabelEncodingStrategy(features=[target_col])
    feature_engineer = FeatureEngineer(label_strategy)
    df_encoded = feature_engineer.apply_feature_engineering(df)

    X = df_encoded.drop(columns=[target_col])
    y_encoded = df_encoded[target_col]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    strategies = {
        "Logistic Regression": LogisticRegressionStrategy(max_iter=2000),
        "Random Forest": RandomForestStrategy(n_estimators=200, max_depth=10),
        "XGBoost": XGBoostStrategy(n_estimators=200, max_depth=5, learning_rate=0.05),
    }

    builder = ModelBuilder(strategy=None)
    evaluator = ModelEvaluator(strategy=ClassificationEvaluationStrategy(average="weighted"))

    results = {}

    for name, strategy in strategies.items():
        logger.info(f"===== Training and evaluating: {name} =====")
        builder.set_strategy(strategy)
        model = builder.build_model()
        model.fit(X_train, y_train)

        metrics = evaluator.evaluate_model(model, X_test, y_test)
        results[name] = metrics

        logger.info(f"{name} -> Accuracy: {metrics['accuracy']:.4f} | F1-score: {metrics['f1_score']:.4f}")
        print(f"\n--- Detailed report for model {name} ---")
        print(metrics["classification_report"])
        print(f"Confusion matrix ({metrics['labels']}):")
        print(metrics["confusion_matrix"])

    best_name = max(results, key=lambda k: results[k]["f1_score"])
    logger.info(f"Best model based on F1-score: {best_name} ({results[best_name]['f1_score']:.4f})")

    print("\n===== Comparison Summary =====")
    for name, res in results.items():
        print(f"{name}: Accuracy={res['accuracy']:.4f} | F1={res['f1_score']:.4f}")


# python -m src.model_evaluator