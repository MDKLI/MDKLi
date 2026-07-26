from functools import lru_cache

from app.ml.model_loader import LoadedModel, load_model_and_manifest
from config.settings import get_settings


@lru_cache
def get_loaded_model() -> LoadedModel:
    """Loads the model + inference manifest once per process and caches
    the result, instead of hitting disk on every request."""
    settings = get_settings()
    return load_model_and_manifest(
        model_path=settings.model_path,
        manifest_path=settings.inference_manifest_path,
    )