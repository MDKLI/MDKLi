import os

from pipelines.training_pipeline import ckd_ml_pipeline
from steps.dynamic_importer import dynamic_importer
from steps.model_loader import model_loader
from steps.predictor import predictor
from zenml import pipeline


@pipeline(enable_cache=False)
def continuous_deployment_pipeline():
    trained_model = ckd_ml_pipeline()
    return trained_model


@pipeline(enable_cache=False)
def inference_pipeline():
    batch_data = dynamic_importer()
    model = model_loader(model_name="CKD Prediction Model")
    predictor(model=model, input_data=batch_data)