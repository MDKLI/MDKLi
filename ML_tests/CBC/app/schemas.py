from typing import List

from pydantic import BaseModel, Field


class CBCRawValues(BaseModel):
    """Raw CBC panel values, as extracted from an image/PDF by the vision
    step, or provided directly for testing without the vision pipeline.

    Field names must exactly match the columns src.feature_extraction
    expects (WBC, RBC, HGB, ...); this is the contract between the vision
    layer and the ML pipeline.
    """

    WBC: float = Field(..., ge=0, description="White blood cell count (x10^9/L)")
    RBC: float = Field(..., ge=0, description="Red blood cell count (x10^12/L)")
    HGB: float = Field(..., ge=0, description="Hemoglobin (g/dL)")
    HCT: float = Field(..., ge=0, description="Hematocrit (%)")
    MCV: float = Field(..., ge=0, description="Mean corpuscular volume (fL)")
    MCH: float = Field(..., ge=0, description="Mean corpuscular hemoglobin (pg)")
    MCHC: float = Field(..., ge=0, description="Mean corpuscular hemoglobin concentration (g/dL)")
    PLT: float = Field(..., ge=0, description="Platelet count (x10^9/L)")
    PDW: float = Field(..., ge=0, description="Platelet distribution width")
    PCT: float = Field(..., ge=0, description="Plateletcrit (%)")
    LYMp: float = Field(..., ge=0, description="Lymphocyte percentage (%)")
    NEUTp: float = Field(..., ge=0, description="Neutrophil percentage (%)")
    LYMn: float = Field(..., ge=0, description="Lymphocyte absolute count")
    NEUTn: float = Field(..., ge=0, description="Neutrophil absolute count")


class PredictionResponse(BaseModel):
    diagnosis: str
    model_mode: str
    extracted_values: CBCRawValues
    warnings: List[str] = []


class HealthResponse(BaseModel):
    status: str
    model_mode: str
    model_loaded: bool