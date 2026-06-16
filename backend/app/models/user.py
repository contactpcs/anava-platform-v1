from pydantic import BaseModel, EmailStr
from typing import Optional


class ProfileBase(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"


class DoctorProfile(ProfileBase):
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    years_of_experience: Optional[int] = None


class PatientProfile(ProfileBase):
    medical_history: Optional[str] = None
    emergency_contact: Optional[str] = None
