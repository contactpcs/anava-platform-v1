import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.models.eeg_report_orm import ReportStatus


class EEGReportOut(BaseModel):
    id: uuid.UUID
    patient_id: str
    session_id: Optional[str] = None
    report_name: str
    file_size_bytes: int
    report_type: str
    sha256_checksum: str
    version: int
    status: ReportStatus
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EEGReportListOut(BaseModel):
    reports: List[EEGReportOut]
    total: int
    skip: int
    limit: int
    has_more: bool
