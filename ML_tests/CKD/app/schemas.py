from pydantic import BaseModel
from typing import Optional, Literal


class CKDInput(BaseModel):
    gfr: float
    serum_creatinine: float
    bun: float
    serum_calcium: float
    urine_ph: float
    c3_c4: float
    ana: int
    hematuria: int
    cluster: int
    oxalate_levels: float
    diet: Literal["high protein", "low protein", "balanced", "vegetarian"]
    alcohol: Literal["daily", "never", "occasionally"]


class CKDPredictionResponse(BaseModel):
    ckd_stage: int
    probability: Optional[float]