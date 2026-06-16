from pydantic import BaseModel
from typing import List, Optional


class AnamnesisStartRequest(BaseModel):
    taken_by: str = "patient"           # 'patient' | 'doctor_on_behalf'
    patient_id: Optional[str] = None    # required when taken_by == 'doctor_on_behalf'


class AnamnesisResponseItem(BaseModel):
    question_id: str
    response_value: Optional[str] = None    # text / textarea / radio / select / conditional_text
    response_values: Optional[List[str]] = None  # checkbox multi-select


class AnamnesisSaveResponseRequest(BaseModel):
    anamnesis_id: str
    question_id: str
    response_value: Optional[str] = None
    response_values: Optional[List[str]] = None


class AnamnesisSubmitRequest(BaseModel):
    anamnesis_id: str
    responses: Optional[List[AnamnesisResponseItem]] = None  # final batch (optional if already saved)


class AnamnesisQuestionOut(BaseModel):
    question_id: str
    section_number: int
    section_title: str
    question_code: str
    question_text: str
    answer_type: str
    is_required: bool
    display_order: int
    depends_on_question_id: Optional[str] = None
    depends_on_value: Optional[str] = None
    helper_text: Optional[str] = None
    options: List[dict] = []


class AnamnesisResponseOut(BaseModel):
    response_id: str
    question_id: str
    response_value: Optional[str] = None
    response_values: Optional[List[str]] = None
    updated_at: Optional[str] = None


class AnamnesisOut(BaseModel):
    anamnesis_id: str
    patient_id: str
    submitted_by: Optional[str] = None
    taken_by: str
    status: str
    completed_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    responses: List[AnamnesisResponseOut] = []
