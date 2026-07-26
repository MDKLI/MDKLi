import argparse

from centralized_logging.logger import get_logger
from pipelines.deployment_pipeline import batch_inference_pipeline

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the CBC batch inference pipeline against a simulated "
                    "or dynamically-imported sample."
    )
    parser.add_argument(
        "--model-mode",
        choices=["standard", "hierarchical"],
        default="hierarchical",
        help="Which trained model artifact to load for prediction. Must match "
             "the model_mode used during training, since standard and "
             "hierarchical models are saved under different filenames. "
             "Default: hierarchical.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logger.info(f"Starting batch inference pipeline with model_mode='{args.model_mode}'")

    batch_inference_pipeline(model_mode=args.model_mode)

    logger.info(
        "Batch inference pipeline finished. Check the predictor step logs "
        "above, or the ZenML dashboard, for the actual prediction output."
    )


if __name__ == "__main__":
    main()

# python -m scripts.run_deployment
# python -m scripts.run_deployment --model-mode standard