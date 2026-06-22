import logging

import click
from pipelines.deployment_pipeline import (
    continuous_deployment_pipeline,
    inference_pipeline,
)
from rich import print
from zenml.integrations.mlflow.mlflow_utils import get_tracking_uri

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


@click.command()
@click.option(
    "--infer-only",
    is_flag=True,
    default=False,
    help="Run inference only without retraining",
)
def run_main(infer_only: bool):

    if not infer_only:
        logger.info("Running continuous deployment pipeline...")
        continuous_deployment_pipeline()

    logger.info("Running inference pipeline...")
    inference_pipeline()

    print(
        "Now run \n "
        f"    mlflow ui --backend-store-uri {get_tracking_uri()}\n"
        "To inspect your experiment runs within the mlflow UI."
    )


if __name__ == "__main__":
    run_main()
# python -m scripts.run_deployment