from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionBase(BaseModel):
    patient_id: str
    doctor_id: str
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None


class SessionOut(SessionBase):
    id: str
    status: str
    created_at: datetime
