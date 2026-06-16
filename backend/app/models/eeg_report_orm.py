import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum as SAEnum,
    Index, Integer, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID

from app.database_tsdb import TSDBBase


class ReportStatus(str, enum.Enum):
    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


def _now():
    return datetime.now(timezone.utc)


class EEGReport(TSDBBase):
    __tablename__ = "eeg_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # created_at is also part of primary key (TimescaleDB hypertable requirement)
    patient_id = Column(String(255), nullable=False)
    session_id = Column(String(255), nullable=True)
    report_name = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size_bytes = Column(Integer, nullable=False)
    report_type = Column(String(100), nullable=False, default="EEG_ANALYSIS")
    sha256_checksum = Column(String(64), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    status = Column(
        SAEnum(ReportStatus, name="report_status", create_type=False),
        nullable=False,
        default=ReportStatus.UPLOADING,
    )
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), primary_key=True, nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    __table_args__ = (
        Index("ix_eeg_reports_patient_created", "patient_id", "created_at"),
        Index("ix_eeg_reports_checksum", "sha256_checksum"),
        Index("ix_eeg_reports_session_id", "session_id"),
        Index("ix_eeg_reports_patient_active", "patient_id", "deleted_at"),
        Index("ix_eeg_reports_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<EEGReport id={self.id} patient={self.patient_id} v{self.version}>"
