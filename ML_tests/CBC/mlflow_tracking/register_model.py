from typing import Optional

import mlflow
from mlflow.exceptions import MlflowException
from mlflow.tracking import MlflowClient

from centralized_logging.logger import get_logger

logger = get_logger(__name__)


def register_and_promote_model(
    run_id: str,
    model_name: str,
    metric_name: str = "f1_score",
    metric_threshold: float = 0.0,
    target_alias: str = "champion",
    artifact_path: str = "model",
) -> Optional[str]:
    """Registers a model from a finished MLflow run, and promotes it to an
    alias (e.g. "champion") only if its recorded metric clears a threshold.

    Uses the modern MLflow alias API (set_registered_model_alias) rather
    than the deprecated stage-based API (transition_model_version_stage),
    which MLflow has been phasing out since 2.9.

    Requires a database-backed tracking store (see mlflow_utils.setup_mlflow);
    the Model Registry raises an error on a plain file store.

    Args:
        run_id: The MLflow run ID that logged the model artifact
            (mlflow.sklearn.log_model / mlflow.pyfunc.log_model).
        model_name: Name to register the model under in the Model Registry.
        metric_name: Metric key, as logged during evaluation, used as the
            promotion gate (e.g. "f1_score", "accuracy").
        metric_threshold: Minimum value metric_name must reach to be promoted.
        target_alias: Alias to assign if the model passes the threshold
            (e.g. "champion", "staging").
        artifact_path: The artifact_path used when the model was logged.

    Returns:
        The registered model version number as a string if promoted,
        otherwise None.
    """
    client = MlflowClient()

    try:
        run = client.get_run(run_id)
    except MlflowException as e:
        raise RuntimeError(f"Could not find MLflow run '{run_id}': {e}") from e

    metric_value = run.data.metrics.get(metric_name)
    if metric_value is None:
        raise ValueError(
            f"Run '{run_id}' has no logged metric '{metric_name}'. "
            f"Available metrics: {list(run.data.metrics.keys())}"
        )

    model_uri = f"runs:/{run_id}/{artifact_path}"

    logger.info(f"Registering model '{model_name}' from {model_uri}...")
    try:
        model_version = mlflow.register_model(model_uri=model_uri, name=model_name)
    except MlflowException as e:
        raise RuntimeError(
            "Failed to register model. If using a local file store, switch to a "
            "database-backed tracking URI first (see mlflow_utils.DEFAULT_TRACKING_URI). "
            f"Original error: {e}"
        ) from e

    logger.info(
        f"Registered '{model_name}' version {model_version.version}. "
        f"{metric_name}={metric_value:.4f} (threshold={metric_threshold})"
    )

    if metric_value < metric_threshold:
        logger.warning(
            f"Model version {model_version.version} did NOT meet the promotion "
            f"threshold ({metric_name}={metric_value:.4f} < {metric_threshold}). "
            "Registered but left un-promoted."
        )
        return None

    client.set_registered_model_alias(
        name=model_name,
        alias=target_alias,
        version=model_version.version,
    )
    logger.info(
        f"Promoted '{model_name}' version {model_version.version} to alias '{target_alias}'."
    )

    return str(model_version.version)


def load_promoted_model(model_name: str, alias: str = "champion"):
    """Loads a model by registry alias - e.g. for use in the deployment
    pipeline, instead of loading a fixed local .pkl path."""
    model_uri = f"models:/{model_name}@{alias}"
    logger.info(f"Loading model from: {model_uri}")
    return mlflow.pyfunc.load_model(model_uri)