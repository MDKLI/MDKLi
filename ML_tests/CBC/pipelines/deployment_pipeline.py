from zenml import pipeline

from steps.deployment.dynamic_importer import dynamic_importer
from steps.deployment.parse_input_step import parse_input_step
from steps.feature_extraction_step import feature_extraction_step
from steps.deployment.apply_inference_preprocessing_step import apply_inference_preprocessing_step
from steps.deployment.model_loader import model_loader
from steps.deployment.predictor import predictor

MANIFEST_PATH = "artifacts/inference_manifest.json"


@pipeline(enable_cache=False)
def batch_inference_pipeline(model_mode: str = "hierarchical"):
    raw_json = dynamic_importer()
    raw_df = parse_input_step(raw_json)

    extracted_df, _ = feature_extraction_step(transformed_df=raw_df)

    preprocessed_df = apply_inference_preprocessing_step(
        df=extracted_df, manifest_path=MANIFEST_PATH
    )

    model = model_loader(model_name="CBC Prediction Model", model_mode=model_mode)

    predictions = predictor(model=model, df=preprocessed_df)

    return predictions


if __name__ == "__main__":
    batch_inference_pipeline(model_mode="hierarchical")

# python -m pipelines.deployment_pipeline