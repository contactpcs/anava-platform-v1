import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.eeg_report_orm import EEGReport, ReportStatus


class EEGReportRepository:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def create(self, data: dict) -> EEGReport:
        report = EEGReport(**data)
        self._session.add(report)
        await self._session.commit()
        await self._session.refresh(report)
        return report

    async def get_by_id(self, report_id: uuid.UUID) -> Optional[EEGReport]:
        result = await self._session.execute(
            select(EEGReport).where(
                and_(EEGReport.id == report_id, EEGReport.deleted_at.is_(None))
            )
        )
        return result.scalar_one_or_none()

    async def get_by_checksum(self, checksum: str, patient_id: str) -> Optional[EEGReport]:
        result = await self._session.execute(
            select(EEGReport).where(
                and_(
                    EEGReport.sha256_checksum == checksum,
                    EEGReport.patient_id == patient_id,
                    EEGReport.deleted_at.is_(None),
                )
            )
        )
        return result.scalar_one_or_none()

    async def list_by_patient(
        self, patient_id: str, skip: int = 0, limit: int = 20
    ) -> Tuple[List[EEGReport], int]:
        base_q = select(EEGReport).where(
            and_(EEGReport.patient_id == patient_id, EEGReport.deleted_at.is_(None))
        )
        count_result = await self._session.execute(
            select(func.count()).select_from(base_q.subquery())
        )
        total = count_result.scalar_one()

        rows = await self._session.execute(
            base_q.order_by(EEGReport.created_at.desc()).offset(skip).limit(limit)
        )
        return list(rows.scalars().all()), total

    async def get_latest_version(self, patient_id: str, report_name: str) -> int:
        result = await self._session.execute(
            select(func.max(EEGReport.version)).where(
                and_(
                    EEGReport.patient_id == patient_id,
                    EEGReport.report_name == report_name,
                    EEGReport.deleted_at.is_(None),
                )
            )
        )
        latest = result.scalar_one_or_none()
        return latest or 0

    async def update_status(self, report: EEGReport, status: ReportStatus) -> EEGReport:
        report.status = status
        report.updated_at = datetime.now(timezone.utc)
        await self._session.commit()
        await self._session.refresh(report)
        return report

    async def soft_delete(self, report: EEGReport) -> EEGReport:
        now = datetime.now(timezone.utc)
        report.deleted_at = now
        report.updated_at = now
        await self._session.commit()
        return report
