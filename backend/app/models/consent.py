from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ConsentFormItem(BaseModel):
    consent_form_id: str
    consent_form_name: str
    is_required: bool
    created_at: Optional[datetime] = None


class ConsentResponseItem(BaseModel):
    consent_form_id: str
    response: bool


class ConsentSubmitRequest(BaseModel):
    user_id: str
    responses: list[ConsentResponseItem]
