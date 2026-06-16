"""
Unit tests for EEG report service layer.

Run with:  pytest tests/test_eeg_reports.py -v
"""
import hashlib
import io
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import UploadFile, HTTPException

from app.models.eeg_report_orm import EEGReport, ReportStatus
from app.services.eeg_report_service import (
    EEGReportService,
    MAX_FILE_SIZE_BYTES,
    PDF_MAGIC,
    _validate,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_pdf(size: int = 1024) -> bytes:
    return PDF_MAGIC + b"\n" + b"x" * (size - len(PDF_MAGIC))


def _make_upload(content: bytes, filename: str = "test.pdf", mime: str = "application/pdf") -> UploadFile:
    f = MagicMock(spec=UploadFile)
    f.filename = filename
    f.content_type = mime
    f.read = AsyncMock(return_value=content)
    return f


def _make_report(
    patient_id: str = "patient-1",
    report_name: str = "EEG Report",
    checksum: Optional[str] = None,
) -> EEGReport:
    r = EEGReport()
    r.id = uuid.uuid4()
    r.patient_id = patient_id
    r.session_id = None
    r.report_name = report_name
    r.file_path = f"/tmp/{r.id}.pdf"
    r.file_size_bytes = 1024
    r.report_type = "EEG_ANALYSIS"
    r.sha256_checksum = checksum or hashlib.sha256(b"data").hexdigest()
    r.version = 1
    r.status = ReportStatus.COMPLETED
    r.deleted_at = None
    r.created_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    return r


# ── Validation tests ──────────────────────────────────────────────────────────

class TestValidation:
    def test_valid_pdf_passes(self):
        content = _make_pdf()
        f = _make_upload(content)
        _validate(f, content)  # must not raise

    def test_wrong_mime_raises(self):
        content = _make_pdf()
        f = _make_upload(content, mime="image/png")
        with pytest.raises(HTTPException) as exc:
            _validate(f, content)
        assert exc.value.status_code == 400

    def test_wrong_extension_raises(self):
        content = _make_pdf()
        f = _make_upload(content, filename="report.docx")
        with pytest.raises(HTTPException) as exc:
            _validate(f, content)
        assert exc.value.status_code == 400

    def test_oversized_file_raises(self):
        content = b"\x00" * (MAX_FILE_SIZE_BYTES + 1)
        f = _make_upload(PDF_MAGIC + content)
        with pytest.raises(HTTPException) as exc:
            _validate(f, PDF_MAGIC + content)
        assert exc.value.status_code == 413

    def test_bad_magic_raises(self):
        content = b"NOTAPDF" + b"x" * 100
        f = _make_upload(content)
        with pytest.raises(HTTPException) as exc:
            _validate(f, content)
        assert exc.value.status_code == 400


# ── Service tests ─────────────────────────────────────────────────────────────

class TestEEGReportService:
    def _svc(self) -> EEGReportService:
        svc = EEGReportService(session=AsyncMock())
        svc._repo = AsyncMock()
        return svc

    @pytest.mark.asyncio
    async def test_upload_success(self, tmp_path):
        svc = self._svc()
        content = _make_pdf()
        upload = _make_upload(content)

        svc._repo.get_by_checksum = AsyncMock(return_value=None)
        svc._repo.get_latest_version = AsyncMock(return_value=0)

        created = _make_report()
        svc._repo.create = AsyncMock(return_value=created)

        with patch("app.services.eeg_report_service._storage_path", return_value=tmp_path / "r.pdf"), \
             patch("app.services.eeg_report_service._write_file"):
            result = await svc.upload_report(upload, "p1", None, "Report")

        assert result.id == created.id
        svc._repo.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_upload_duplicate_raises_409(self, tmp_path):
        svc = self._svc()
        content = _make_pdf()
        upload = _make_upload(content)
        existing = _make_report()
        svc._repo.get_by_checksum = AsyncMock(return_value=existing)

        with pytest.raises(HTTPException) as exc:
            await svc.upload_report(upload, "p1", None, "Report")
        assert exc.value.status_code == 409

    @pytest.mark.asyncio
    async def test_get_report_not_found_raises_404(self):
        svc = self._svc()
        svc._repo.get_by_id = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await svc.get_report(uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_get_report_returns_out(self):
        svc = self._svc()
        report = _make_report()
        svc._repo.get_by_id = AsyncMock(return_value=report)
        result = await svc.get_report(report.id)
        assert result.id == report.id

    @pytest.mark.asyncio
    async def test_delete_report_calls_soft_delete(self, tmp_path):
        svc = self._svc()
        report = _make_report()
        report.file_path = str(tmp_path / "f.pdf")
        (tmp_path / "f.pdf").write_bytes(b"%PDF-test")
        svc._repo.get_by_id = AsyncMock(return_value=report)
        svc._repo.soft_delete = AsyncMock()
        await svc.delete_report(report.id)
        svc._repo.soft_delete.assert_awaited_once_with(report)

    @pytest.mark.asyncio
    async def test_delete_report_not_found_raises_404(self):
        svc = self._svc()
        svc._repo.get_by_id = AsyncMock(return_value=None)
        with pytest.raises(HTTPException) as exc:
            await svc.delete_report(uuid.uuid4())
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_list_patient_reports(self):
        svc = self._svc()
        reports = [_make_report(patient_id="p1"), _make_report(patient_id="p1")]
        svc._repo.list_by_patient = AsyncMock(return_value=(reports, 2))
        result, total = await svc.list_patient_reports("p1")
        assert total == 2
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_versioning_increments(self, tmp_path):
        svc = self._svc()
        content = _make_pdf()
        upload = _make_upload(content)
        svc._repo.get_by_checksum = AsyncMock(return_value=None)
        svc._repo.get_latest_version = AsyncMock(return_value=2)

        created = _make_report()
        created.version = 3
        svc._repo.create = AsyncMock(return_value=created)

        with patch("app.services.eeg_report_service._storage_path", return_value=tmp_path / "r.pdf"), \
             patch("app.services.eeg_report_service._write_file"):
            result = await svc.upload_report(upload, "p1", None, "Report")

        # version in create call should be 3
        call_kwargs = svc._repo.create.call_args[0][0]
        assert call_kwargs["version"] == 3
