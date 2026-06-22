import logging
import os

from pipelines.training_pipeline import ckd_ml_pipeline
from steps.dynamic_importer import dynamic_importer
from steps.model_loader import model_loader
from steps.predictor import predictor
from zenml import pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

requirements_file = os.path.join(os.path.dirname(__file__), "requirements.txt")


@pipeline(enable_cache=False)
def continuous_deployment_pipeline():

    logger.info("Starting continuous deployment pipeline...")

    trained_model = ckd_ml_pipeline()

    return trained_model


@pipeline(enable_cache=False)
def inference_pipeline():

    logger.info("Starting inference pipeline...")

    batch_data = dynamic_importer()

    model = model_loader(model_name="CKD Prediction Model")

    predictor(model=model, input_data=batch_data)