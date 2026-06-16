from datetime import date, time, datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

AppointmentStatus = Literal[
    "scheduled", "confirmed", "checked_in", "in_progress",
    "completed", "cancelled", "no_show", "rescheduled",
]
AppointmentType = Literal["consultation", "follow_up", "assessment", "emergency", "video"]


class AppointmentCreate(BaseModel):
    """Staff roles create an appointment directly against a known slot."""
    patient_id:        str
    doctor_id:         str
    appointment_date:  date
    start_time:        time
    appointment_type:  AppointmentType = "consultation"
    reason:            Optional[str] = None
    patient_complaint: Optional[str] = None
    notes:             Optional[str] = None
    appointment_request_id: Optional[str] = None  # set when created from approving a request


class AppointmentReschedule(BaseModel):
    appointment_date: date
    start_time:       time
    reason:           Optional[str] = None


class AppointmentCancel(BaseModel):
    cancellation_reason: str = Field(..., min_length=3, max_length=500)


class AppointmentUpdate(BaseModel):
    notes:             Optional[str] = None
    patient_complaint: Optional[str] = None
    appointment_type:  Optional[AppointmentType] = None


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    appointment_id:   str
    clinic_id:        str
    patient_id:       str
    patient_name:     Optional[str] = None
    doctor_id:        str
    doctor_name:      Optional[str] = None
    appointment_date: date
    start_time:       time
    end_time:         time
    start_at:         datetime
    end_at:           datetime
    status:           AppointmentStatus
    appointment_type: AppointmentType
    reason:           Optional[str] = None
    notes:            Optional[str] = None
    patient_complaint: Optional[str] = None
    booked_by:        str
    booked_by_role:   str
    appointment_request_id: Optional[str] = None
    rescheduled_from: Optional[str] = None
    rescheduled_to:   Optional[str] = None
    created_at:       datetime
    updated_at:       datetime
