import time

from google import genai
from google.genai import errors as genai_errors
from google.genai import types

from centralized_logging.logger import get_logger
from config.settings import get_settings
from app.vision.image_preprocessor import PreparedImage
from app.vision.prompt_templates import (
    EXTRACTION_SYSTEM_PROMPT,
    build_extraction_prompt,
    build_retry_prompt,
)

logger = get_logger(__name__)

MAX_TRANSIENT_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2  # doubles each attempt: 2s, 4s, 8s


class VisionClient:
    """Thin wrapper around the Gemini API (via the `google-genai` SDK) for
    CBC report extraction. Only this file is provider-specific;
    prompt_templates, result_parser, and validators are unaware of which
    vision provider is behind this class."""

    def __init__(self):
        settings = get_settings()
        if not settings.gemini_api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is not set. Add it to your .env file "
                "(see config/settings.py)."
            )
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.vision_model_name

    def _call(self, prepared_image: PreparedImage, prompt: str) -> str:
        last_error = None

        for attempt in range(1, MAX_TRANSIENT_RETRIES + 1):
            try:
                response = self._client.models.generate_content(
                    model=self._model,
                    contents=[
                        types.Part.from_bytes(
                            data=prepared_image.raw_bytes,
                            mime_type=prepared_image.media_type,
                        ),
                        prompt,
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=EXTRACTION_SYSTEM_PROMPT,
                    ),
                )
                response_text = response.text or ""
                logger.info(f"Vision model response length: {len(response_text)} chars")
                return response_text

            except genai_errors.ServerError as e:
                last_error = e
                is_transient = getattr(e, "code", None) in (503, 429)
                if not is_transient or attempt == MAX_TRANSIENT_RETRIES:
                    raise

                wait_seconds = RETRY_BACKOFF_SECONDS * (2 ** (attempt - 1))
                logger.warning(
                    f"Vision API transient error (attempt {attempt}/{MAX_TRANSIENT_RETRIES}): "
                    f"{e}. Retrying in {wait_seconds}s..."
                )
                time.sleep(wait_seconds)

        raise last_error

    def extract_cbc_values(self, prepared_image: PreparedImage) -> str:
        prompt = build_extraction_prompt()
        return self._call(prepared_image, prompt)

    def retry_extraction(self, prepared_image: PreparedImage, previous_response: str, error: str) -> str:
        prompt = build_retry_prompt(previous_response, error)
        return self._call(prepared_image, prompt)
