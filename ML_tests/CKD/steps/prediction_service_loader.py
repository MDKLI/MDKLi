import logging

from zenml import step
from zenml.integrations.mlflow.model_deployers import MLFlowModelDeployer
from zenml.integrations.mlflow.services import MLFlowDeploymentService

logger = logging.getLogger(__name__)


@step(enable_cache=False)
def prediction_service_loader(pipeline_name: str, step_name: str) -> MLFlowDeploymentService:

    try:
        model_deployer = MLFlowModelDeployer.get_active_model_deployer()

        existing_services = model_deployer.find_model_server(
            pipeline_name=pipeline_name,
            pipeline_step_name=step_name,
        )

        if not existing_services:
            raise RuntimeError(
                f"No MLflow prediction service deployed by the "
                f"{step_name} step in the {pipeline_name} "
                f"pipeline is currently running."
            )

        logger.info(f"Found {len(existing_services)} service(s), loading the first one.")

        return existing_services[0]

    except RuntimeError:
        raise

    except Exception as e:
        logger.error(f"Failed to load prediction service: {e}")
        raise RuntimeError(f"Failed to load prediction service: {e}") from e