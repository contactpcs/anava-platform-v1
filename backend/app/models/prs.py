from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class ScaleOut(BaseModel):
    scale_id: str            # TEXT PK e.g. "EQ-5D-5L/2026"
    scale_code: str
    scale_name: str
    is_common_scale: bool = False
    num_diseases_used: int = 1


class QuestionOut(BaseModel):
    question_id: str         # TEXT PK e.g. "PDSS/004"
    question_code: str
    question_text: str
    answer_type: str
    display_order: int = 0
    is_required: bool = True
    is_common_scale: bool = False
