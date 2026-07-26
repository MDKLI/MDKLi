from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from centralized_logging.logger import get_logger
from config.settings import get_settings
from app.dependencies import get_loaded_model
from app.ml.model_loader import LoadedModel
from app.schemas import CBCRawValues, PredictionResponse
from app.services.inference_service import InferenceService
from app.vision.image_preprocessor import prepare_file_for_vision
from app.vision.imputation import impute_missing_optional_fields
from app.vision.prompt_templates import CBC_FIELDS
from app.vision.result_parser import parse_cbc_extraction
from app.vision.validators import validate_extracted_values
from app.vision.vision_client import VisionClient

logger = get_logger(__name__)
router = APIRouter()


@router.post("/predict/from-report", response_model=PredictionResponse)
async def predict_from_report(
    file: UploadFile = File(...),
    loaded_model: LoadedModel = Depends(get_loaded_model),
) -> PredictionResponse:
    """Accepts a CBC report image or PDF, extracts values via the Vision
    LLM, and runs the trained model on the extracted values."""
    settings = get_settings()

    file_bytes = await file.read()
    max_bytes = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.max_upload_size_mb}MB upload limit.",
        )

    try:
        prepared_image = prepare_file_for_vision(file_bytes, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        vision_client = VisionClient()
    except RuntimeError as e:
        logger.error(f"Vision client could not be initialized: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Vision service is not configured correctly: {e}",
        ) from e

    try:
        raw_text = vision_client.extract_cbc_values(prepared_image)
        extracted_values = parse_cbc_extraction(raw_text)
    except ValueError as first_error:
        logger.warning(f"Vision extraction failed once, retrying: {first_error}")
        try:
            raw_text = vision_client.retry_extraction(prepared_image, raw_text, str(first_error))
            extracted_values = parse_cbc_extraction(raw_text)
        except ValueError as second_error:
            logger.error(f"Vision extraction failed after retry: {second_error}")
            raise HTTPException(
                status_code=422,
                detail=f"Could not extract CBC values from the report: {second_error}",
            ) from second_error
    except Exception as e:
        logger.error(f"Vision API call failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail=f"Vision service call failed: {e}",
        ) from e

    extracted_values, imputation_warnings = impute_missing_optional_fields(extracted_values)

    remaining_null = [f for f in CBC_FIELDS if extracted_values.get(f) is None]
    if remaining_null:
        raise HTTPException(
            status_code=422,
            detail=f"Could not determine values for: {remaining_null}",
        )

    sanity_warnings = validate_extracted_values(extracted_values)

    service = InferenceService(loaded_model)
    try:
        diagnosis, service_warnings = service.predict(extracted_values)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    return PredictionResponse(
        diagnosis=diagnosis,
        model_mode=settings.model_mode,
        extracted_values=CBCRawValues(**extracted_values),
        warnings=imputation_warnings + sanity_warnings + service_warnings,
    )


@router.post("/predict/from-values", response_model=PredictionResponse)
def predict_from_values(
    values: CBCRawValues,
    loaded_model: LoadedModel = Depends(get_loaded_model),
) -> PredictionResponse:
    """Accepts raw CBC values directly, bypassing the vision step - useful
    for testing and for integrations that already have structured lab data."""
    settings = get_settings()

    service = InferenceService(loaded_model)
    try:
        diagnosis, warnings = service.predict(values.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    return PredictionResponse(
        diagnosis=diagnosis,
        model_mode=settings.model_mode,
        extracted_values=values,
        warnings=warnings,
    )