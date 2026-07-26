from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized configuration, read from environment variables / .env.

    Requires the `pydantic-settings` package:
        pip install pydantic-settings --break-system-packages
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Vision LLM (Gemini) ---
    gemini_api_key: str = ""
    # Check https://ai.google.dev/gemini-api/docs/models for the current
    # model lineup before deploying; model names/aliases change over time.
    vision_model_name: str = "gemini-flash-latest"

    # --- Anthropic (kept for reference / if you switch back) ---
    anthropic_api_key: str = ""

    # --- Model artifacts ---
    model_mode: Literal["standard", "hierarchical"] = "hierarchical"
    standard_model_path: str = "artifacts/cbc_model.pkl"
    hierarchical_model_path: str = "artifacts/cbc_hierarchical_model.pkl"
    inference_manifest_path: str = "artifacts/inference_manifest.json"

    # --- MLflow ---
    mlflow_tracking_uri: str = "sqlite:///artifacts/mlflow.db"
    mlflow_model_name: str = "CBC Prediction Model"

    # --- API behavior ---
    max_upload_size_mb: int = 10
    log_level: str = "INFO"

    @property
    def model_path(self) -> str:
        """Resolves which trained model artifact to load based on model_mode,
        since standard and hierarchical models are saved under different
        filenames (see steps/train_model.py vs steps/train_hierarchical_model_step.py)."""
        return (
            self.hierarchical_model_path
            if self.model_mode == "hierarchical"
            else self.standard_model_path
        )


@lru_cache
def get_settings() -> Settings:
    """Cached so Settings() (which reads the .env file) only runs once per
    process, not on every request."""
    return Settings()
