import os
from contextlib import contextmanager
from typing import Dict, Optional

import mlflow

from centralized_logging.logger import get_logger

logger = get_logger(__name__)

DEFAULT_TRACKING_URI = "sqlite:///artifacts/mlflow.db"
DEFAULT_EXPERIMENT_NAME = "CBC_Diagnosis"


def setup_mlflow(
    tracking_uri: Optional[str] = None,
    experiment_name: str = DEFAULT_EXPERIMENT_NAME,
) -> str:
    """Configures the MLflow tracking URI and active experiment.

    Must be called once, before any mlflow.start_run() call in the
    process (e.g. at the top of a pipeline), otherwise MLflow silently
    falls back to a local ./mlruns file store.

    Important: the Model Registry (mlflow.register_model, aliases,
    stages) requires a database-backed tracking store. A plain file
    store (MLflow's default) does NOT support it and will raise if you
    try to register a model. DEFAULT_TRACKING_URI points at a local
    SQLite file for that reason. For a shared/team setup, point this at
    a real MLflow Tracking Server instead (e.g. "http://mlflow-server:5000"),
    backed by Postgres/MySQL, as planned in the docker-compose setup.

    Returns:
        The active experiment ID.
    """
    uri = tracking_uri or os.environ.get("MLFLOW_TRACKING_URI", DEFAULT_TRACKING_URI)

    if uri.startswith("sqlite:///"):
        db_path = uri.replace("sqlite:///", "")
        os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    mlflow.set_tracking_uri(uri)
    experiment = mlflow.set_experiment(experiment_name)

    logger.info(f"MLflow tracking URI: {uri}")
    logger.info(f"MLflow experiment: '{experiment_name}' (id={experiment.experiment_id})")

    return experiment.experiment_id


@contextmanager
def mlflow_run(run_name: Optional[str] = None, nested: bool = False, tags: Optional[Dict] = None):
    """Thin wrapper around mlflow.start_run with a safety check.

    Warns (rather than silently no-op'ing) if nested=True is requested
    without an active parent run, since MLflow ignores `nested` in that
    case and just starts a top-level run instead. Use this from every
    step that logs to MLflow (train_model_step, train_hierarchical_model_step,
    evaluate_model_step) so all of a pipeline run's metrics land under one
    parent run when the pipeline itself opens the parent run first.
    """
    if nested and mlflow.active_run() is None:
        logger.warning(
            "mlflow_run called with nested=True but no active parent run exists. "
            "MLflow will start a top-level run instead of a true nested run. "
            "Wrap the calling pipeline in its own mlflow.start_run() to fix this."
        )

    with mlflow.start_run(run_name=run_name, nested=nested, tags=tags) as run:
        yield run


def log_metrics_safe(metrics: Dict[str, float], prefix: str = "") -> None:
    """Logs only numeric, non-None values to the active MLflow run.

    Skips (with a debug log) anything that isn't a plain int/float,
    since mlflow.log_metric raises on None, strings, or nested dicts.
    """
    for key, value in metrics.items():
        if isinstance(value, (int, float)):
            mlflow.log_metric(f"{prefix}{key}", value)
        else:
            logger.debug(f"Skipping non-numeric metric '{key}' (type={type(value).__name__})")


def log_per_class_metrics(per_class_metrics: Dict[str, Dict[str, float]]) -> None:
    """Logs a nested {class_name: {metric_name: value}} dict - e.g. the
    per_class_metrics output of ClassificationEvaluationStrategy - with
    keys flattened to '{class_name}_{metric_name}'."""
    for class_name, class_metrics in per_class_metrics.items():
        log_metrics_safe(class_metrics, prefix=f"{class_name}_")