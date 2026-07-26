import argparse

from centralized_logging.logger import get_logger
from pipelines.train_pipeline import cbc_ml_pipeline

logger = get_logger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run the CBC training pipeline (ingestion through model registration)."
    )
    parser.add_argument(
        "--model-mode",
        choices=["standard", "hierarchical"],
        default="hierarchical",
        help="Training strategy: 'standard' (single model, label-encoded target) "
             "or 'hierarchical' (two-stage model for rare diagnosis classes, "
             "original string labels). Default: hierarchical.",
    )
    parser.add_argument(
        "--model-type",
        choices=["logreg", "rf", "xgboost"],
        default="rf",
        help="Base model algorithm used for the standard model, or for both "
             "stages of the hierarchical model. Default: rf.",
    )
    parser.add_argument(
        "--promotion-metric",
        default="f1_score",
        help="Metric used as the Model Registry promotion gate. Default: f1_score.",
    )
    parser.add_argument(
        "--promotion-threshold",
        type=float,
        default=0.75,
        help="Minimum metric value required to promote the model to the "
             "'champion' alias. Default: 0.75.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    logger.info(
        f"Starting training pipeline with model_mode='{args.model_mode}', "
        f"model_type='{args.model_type}', "
        f"promotion_metric='{args.promotion_metric}' >= {args.promotion_threshold}"
    )

    cbc_ml_pipeline(
        model_mode=args.model_mode,
        model_type=args.model_type,
        promotion_metric=args.promotion_metric,
        promotion_threshold=args.promotion_threshold,
    )

    logger.info("Training pipeline finished.")


if __name__ == "__main__":
    main()

# python -m scripts.run_pipeline
# python -m scripts.run_pipeline --model-mode standard --model-type xgboost
# python -m scripts.run_pipeline --model-mode hierarchical --promotion-threshold 0.8