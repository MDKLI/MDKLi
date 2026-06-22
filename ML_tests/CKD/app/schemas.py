from pydantic import BaseModel
from typing import Optional


class CKDInput(BaseModel):
    gfr: float
    kidney_function_score: float
    gfr_bun_ratio: float
    cluster: float
    urine_ph: float
    inflammation_score: float
    c3_c4: float
    c3_c4_norm: float
    bun: float
    ana: float


class CKDPredictionResponse(BaseModel):
    ckd_stage: int
    probability: Optional[float]