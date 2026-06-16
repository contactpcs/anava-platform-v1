from datetime import date, time, datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

from app.models.appointment import AppointmentType

RequestType   = Literal["new", "reschedule"]
RequestStatus = Literal["pending", "approved", "rejected", "cancelled_by_patient", "expired"]
TimeWindow    = Literal["morning", "afternoon", "evening", "any"]
Urgency       = Literal["normal", "urgent", "emergency"]


class AppointmentRequestCreate(BaseModel):
    """Patient requests a new appointment (no slot picker)."""
    preferred_date_1:      date
    preferred_date_2:      Optional[date] = None
    preferred_date_3:      Optional[date] = None
    preferred_time_window: TimeWindow = "any"
    patient_complaint:     str = Field(..., min_length=5, max_length=2000)
    reason:                Optional[str] = None
    urgency:               Urgency = "normal"


class RescheduleRequestCreate(BaseModel):
    """Patient requests a reschedule of an existing appointment."""
    preferred_date_1:      date
    preferred_date_2:      Optional[date] = None
    preferred_date_3:      Optional[date] = None
    preferred_time_window: TimeWindow = "any"
    reason:                str = Field(..., min_length=5, max_length=500)


class RequestApprove(BaseModel):
    """Receptionist/admin approval — picks the actual slot."""
    appointment_date: date
    start_time:       time
    appointment_type: AppointmentType = "consultation"
    notes:            Optional[str] = None


class RequestReject(BaseModel):
    review_notes: str = Field(..., min_length=5, max_length=500)


class AppointmentRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id:            str
    clinic_id:             str
    patient_id:            str
    patient_name:          Optional[str] = None
    doctor_id:             str
    doctor_name:           Optional[str] = None
    request_type:          RequestType
    parent_appointment_id: Optional[str] = None
    preferred_date_1:      date
    preferred_date_2:      Optional[date] = None
    preferred_date_3:      Optional[date] = None
    preferred_time_window: TimeWindow
    patient_complaint:     str
    reason:                Optional[str] = None
    urgency:               Urgency
    status:                RequestStatus
    approved_appointment_id: Optional[str] = None
    reviewed_by:           Optional[str] = None
    reviewer_name:         Optional[str] = None
    reviewed_at:           Optional[datetime] = None
    review_notes:          Optional[str] = None
    expires_at:            Optional[datetime] = None
    created_at:            datetime
    updated_at:            datetime
