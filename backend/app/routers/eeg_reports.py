import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, File, Form, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database_tsdb import get_tsdb_session
from app.dependencies import get_current_user, require_service_key, require_staff
from app.limiter import limiter
from app.services.eeg_report_service import EEGReportService
from app.utils.responses import paginated_response, success_response

logger = structlog.get_logger()
router = APIRouter()


def _svc(session: AsyncSession = Depends(get_tsdb_session)) -> EEGReportService:
    return EEGReportService(session)


# ── POST /reports/upload ──────────────────────────────────────────────────────

@router.post("/upload", status_code=201)
@limiter.limit("20/minute")
async def upload_report(
    request: Request,
    file: UploadFile = File(..., description="PDF file (max 20 MB)"),
    patient_id: str = Form(...),
    session_id: Optional[str] = Form(None),
    report_name: str = Form(...),
    report_type: str = Form("EEG_ANALYSIS"),
    current_user: dict = Depends(require_staff),
    svc: EEGReportService = Depends(_svc),
):
    """Upload a PDF EEG report and store metadata in TimescaleDB."""
    report = await svc.upload_report(file, patient_id, session_id, report_name, report_type)
    return success_response(report.model_dump(mode="json"), "Report uploaded successfully", 201)


# ── POST /reports/register ───────────────────────────────────────────────────

class RegisterReportRequest(BaseModel):
    patient_id: str
    session_id: Optional[str] = None
    report_name: str
    report_type: str = "EEG_ANALYSIS"
    s3_key: str
    file_size_bytes: int
    sha256_checksum: str


@router.post("/register", status_code=201)
@limiter.limit("20/minute")
async def register_report(
    request: Request,
    body: RegisterReportRequest,
    _: None = Depends(require_service_key),
    svc: EEGReportService = Depends(_svc),
):
    """Register a PDF already uploaded to S3 — no file transfer needed."""
    report = await svc.register_report(
        patient_id=body.patient_id,
        session_id=body.session_id,
        report_name=body.report_name,
        report_type=body.report_type,
        s3_key=body.s3_key,
        file_size_bytes=body.file_size_bytes,
        sha256_checksum=body.sha256_checksum,
    )
    return success_response(report.model_dump(mode="json"), "Report registered successfully", 201)


# ── GET /reports/{report_id} ──────────────────────────────────────────────────

@router.get("/{report_id}")
@limiter.limit("120/minute")
async def get_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: EEGReportService = Depends(_svc),
):
    """Return metadata for a single EEG report."""
    report = await svc.get_report(report_id)
    return success_response(report.model_dump(mode="json"))


# ── GET /reports/{report_id}/download ────────────────────────────────────────

@router.get("/{report_id}/download")
@limiter.limit("30/minute")
async def download_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: dict = Depends(get_current_user),
    svc: EEGReportService = Depends(_svc),
):
    """Return a 15-minute pre-signed S3 URL for the PDF."""
    url = await svc.get_report_download_url(report_id)
    return {"url": url}


# ── GET /patients/{patient_id}/reports ───────────────────────────────────────

@router.get("/patient/{patient_id}/reports")
@limiter.limit("60/minute")
async def list_patient_reports(
    request: Request,
    patient_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    svc: EEGReportService = Depends(_svc),
):
    """Return all EEG reports for a patient."""
    reports, total = await svc.list_patient_reports(patient_id, skip, limit)
    return paginated_response(
        [r.model_dump(mode="json") for r in reports],
        total,
        skip,
        limit,
    )


# ── DELETE /reports/{report_id} ───────────────────────────────────────────────

@router.delete("/{report_id}")
@limiter.limit("20/minute")
async def delete_report(
    request: Request,
    report_id: uuid.UUID,
    current_user: dict = Depends(require_staff),
    svc: EEGReportService = Depends(_svc),
):
    """Soft-delete metadata and remove the physical PDF file."""
    await svc.delete_report(report_id)
    return success_response(None, "Report deleted successfully")
