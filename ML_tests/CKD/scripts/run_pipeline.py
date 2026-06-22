import logging

import click
from pipelines.training_pipeline import ckd_ml_pipeline
from zenml.integrations.mlflow.mlflow_utils import get_tracking_uri

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)


@click.command()
def main():

    try:
        logger.info("Starting CKD ML Pipeline...")
        ckd_ml_pipeline()
        logger.info("Pipeline completed successfully.")

    except Exception as e:
        logger.error(f"Pipeline failed: {e}")
        raise

    print(
        "Now run \n "
        f"    mlflow ui --backend-store-uri '{get_tracking_uri()}'\n"
        "To inspect your experiment runs within the mlflow UI.\n"
        "You can find your runs tracked within the experiment."
    )


if __name__ == "__main__":
    main()


# python -m scripts.run_pipeline