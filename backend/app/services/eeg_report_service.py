import hashlib
import uuid
from pathlib import Path
from typing import List, Optional, Tuple

import boto3
import structlog
from botocore.exceptions import ClientError
from fastapi import HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.eeg_report_orm import ReportStatus
from app.repositories.eeg_report_repository import EEGReportRepository
from app.schemas.eeg_report import EEGReportOut

logger = structlog.get_logger()

MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_MIME_TYPES = {"application/pdf", "application/x-pdf"}
ALLOWED_EXTENSIONS = {".pdf"}
PDF_MAGIC = b"%PDF"
PRESIGNED_URL_EXPIRY = 900  # 15 minutes


# ── Validation ────────────────────────────────────────────────────────────────

def _validate(file: UploadFile, content: bytes) -> None:
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid MIME type '{file.content_type}'. Only PDF allowed.",
        )
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .pdf files accepted.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File size {len(content):,} bytes exceeds 20 MB limit.",
        )
    if not content.startswith(PDF_MAGIC):
        raise HTTPException(status_code=400, detail="File is not a valid PDF (bad magic bytes).")


# ── S3 helpers ────────────────────────────────────────────────────────────────

def _get_s3_client():
    settings = get_settings()
    kwargs = {"region_name": settings.AWS_REGION}
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **kwargs)


def _s3_key(patient_id: str, report_uuid: str) -> str:
    return f"eeg_reports/{patient_id}/{report_uuid}.pdf"


def _upload_to_s3(key: str, content: bytes) -> None:
    settings = get_settings()
    s3 = _get_s3_client()
    s3.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=content,
        ContentType="application/pdf",
    )
    logger.info("eeg_s3_upload", key=key, size_bytes=len(content))


def _delete_from_s3(key: str) -> None:
    settings = get_settings()
    try:
        s3 = _get_s3_client()
        s3.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
        logger.info("eeg_s3_deleted", key=key)
    except ClientError as exc:
        logger.warning("eeg_s3_delete_failed", key=key, error=str(exc))


def _presigned_url(key: str) -> str:
    settings = get_settings()
    s3 = _get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
        ExpiresIn=PRESIGNED_URL_EXPIRY,
    )


# ── Service ───────────────────────────────────────────────────────────────────

class EEGReportService:
    def __init__(self, session: AsyncSession):
        self._repo = EEGReportRepository(session)

    async def upload_report(
        self,
        file: UploadFile,
        patient_id: str,
        session_id: Optional[str],
        report_name: str,
        report_type: str = "EEG_ANALYSIS",
    ) -> EEGReportOut:
        content = await file.read()
        _validate(file, content)

        checksum = hashlib.sha256(content).hexdigest()

        existing = await self._repo.get_by_checksum(checksum, patient_id)
        if existing:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicate report: identical file already uploaded.",
                    "existing_report_id": str(existing.id),
                },
            )

        version = (await self._repo.get_latest_version(patient_id, report_name)) + 1
        report_uuid = str(uuid.uuid4())
        s3_key = _s3_key(patient_id, report_uuid)

        try:
            _upload_to_s3(s3_key, content)
        except Exception as exc:
            logger.error("eeg_s3_upload_error", error=str(exc))
            raise HTTPException(status_code=500, detail="Failed to upload report to S3.")

        try:
            report = await self._repo.create(
                {
                    "id": uuid.UUID(report_uuid),
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "report_name": report_name,
                    "file_path": s3_key,
                    "file_size_bytes": len(content),
                    "report_type": report_type,
                    "sha256_checksum": checksum,
                    "version": version,
                    "status": ReportStatus.COMPLETED,
                }
            )
        except Exception as exc:
            _delete_from_s3(s3_key)
            logger.error("eeg_db_insert_error", error=str(exc))
            raise HTTPException(status_code=500, detail="Failed to persist report metadata.")

        logger.info(
            "eeg_report_uploaded",
            report_id=str(report.id),
            patient_id=patient_id,
            size_bytes=len(content),
            version=version,
        )
        return EEGReportOut.model_validate(report)

    async def get_report(self, report_id: uuid.UUID) -> EEGReportOut:
        report = await self._repo.get_by_id(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="EEG report not found.")
        return EEGReportOut.model_validate(report)

    async def get_report_download_url(self, report_id: uuid.UUID) -> str:
        report = await self._repo.get_by_id(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="EEG report not found.")
        try:
            return _presigned_url(report.file_path)
        except ClientError as exc:
            logger.error("eeg_presign_error", key=report.file_path, error=str(exc))
            raise HTTPException(status_code=500, detail="Failed to generate download URL.")

    async def list_patient_reports(
        self, patient_id: str, skip: int = 0, limit: int = 20
    ) -> Tuple[List[EEGReportOut], int]:
        reports, total = await self._repo.list_by_patient(patient_id, skip, limit)
        return [EEGReportOut.model_validate(r) for r in reports], total

    async def upload_pdf_from_path(
        self,
        pdf_path: Path,
        patient_id: str,
        session_id: Optional[str],
        report_name: str,
        report_type: str = "EEG_ANALYSIS",
    ) -> Optional[str]:
        try:
            content = pdf_path.read_bytes()
        except Exception as exc:
            logger.error("eeg_pdf_read_error", path=str(pdf_path), error=str(exc))
            return None

        if not content.startswith(PDF_MAGIC):
            logger.warning("eeg_not_a_pdf", path=str(pdf_path))
            return None

        checksum = hashlib.sha256(content).hexdigest()
        existing = await self._repo.get_by_checksum(checksum, patient_id)
        if existing:
            return str(existing.id)

        version = (await self._repo.get_latest_version(patient_id, report_name)) + 1
        report_uuid = str(uuid.uuid4())
        s3_key = _s3_key(patient_id, report_uuid)

        try:
            _upload_to_s3(s3_key, content)
        except Exception as exc:
            logger.error("eeg_s3_upload_error", error=str(exc))
            return None

        try:
            report = await self._repo.create(
                {
                    "id": uuid.UUID(report_uuid),
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "report_name": report_name,
                    "file_path": s3_key,
                    "file_size_bytes": len(content),
                    "report_type": report_type,
                    "sha256_checksum": checksum,
                    "version": version,
                    "status": ReportStatus.COMPLETED,
                }
            )
            logger.info("eeg_report_saved_from_analysis", report_id=str(report.id), patient_id=patient_id)
            return str(report.id)
        except Exception as exc:
            _delete_from_s3(s3_key)
            logger.error("eeg_db_insert_error", error=str(exc))
            return None

    async def register_report(
        self,
        patient_id: str,
        session_id: Optional[str],
        report_name: str,
        report_type: str,
        s3_key: str,
        file_size_bytes: int,
        sha256_checksum: str,
    ) -> EEGReportOut:
        existing = await self._repo.get_by_checksum(sha256_checksum, patient_id)
        if existing:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Duplicate report: identical file already uploaded.",
                    "existing_report_id": str(existing.id),
                },
            )

        version = (await self._repo.get_latest_version(patient_id, report_name)) + 1
        report_uuid = str(uuid.uuid4())

        try:
            report = await self._repo.create(
                {
                    "id": uuid.UUID(report_uuid),
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "report_name": report_name,
                    "file_path": s3_key,
                    "file_size_bytes": file_size_bytes,
                    "report_type": report_type,
                    "sha256_checksum": sha256_checksum,
                    "version": version,
                    "status": ReportStatus.COMPLETED,
                }
            )
        except Exception as exc:
            logger.error("eeg_db_insert_error", error=str(exc))
            raise HTTPException(status_code=500, detail="Failed to persist report metadata.")

        logger.info(
            "eeg_report_registered",
            report_id=str(report.id),
            patient_id=patient_id,
            s3_key=s3_key,
        )
        return EEGReportOut.model_validate(report)

    async def delete_report(self, report_id: uuid.UUID) -> None:
        report = await self._repo.get_by_id(report_id)
        if not report:
            raise HTTPException(status_code=404, detail="EEG report not found.")
        s3_key = report.file_path
        await self._repo.soft_delete(report)
        _delete_from_s3(s3_key)
        logger.info("eeg_report_deleted", report_id=str(report_id))
