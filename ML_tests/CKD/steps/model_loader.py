import logging

import joblib
from zenml import step

logger = logging.getLogger(__name__)


@step
def model_loader(model_name: str):

    try:
        model = joblib.load("artifacts/ckd_model.pkl")
        logger.info(f"Model '{model_name}' loaded successfully from artifacts/ckd_model.pkl")
        return model

    except Exception as e:
        logger.error(f"Failed to load model '{model_name}': {e}")
        raise RuntimeError(f"Failed to load model '{model_name}': {e}") from e
    


    

# zenml model version --help

    #  zenml model version list --model "CKD Prediction Model"



# python -c "
# from zenml.client import Client
# client = Client()
# mv = client.get_model_version('CKD Prediction Model', '19')
# print(dir(mv))
# "# "



# python -c "
# from zenml.client import Client
# client = Client()
# mv = client.get_model_version('CKD Prediction Model', '19')
# print('model_artifacts:', mv.model_artifacts)
# print('data_artifacts:', mv.data_artifacts)
# print('deployment_artifacts:', mv.deployment_artifacts)
# "