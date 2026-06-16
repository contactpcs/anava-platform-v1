"""APScheduler lifecycle, started/stopped from the FastAPI lifespan.

Gated by settings.RUN_SCHEDULER so only one process (or a dedicated scheduler
container) runs the jobs in a multi-worker deployment. Uses the default
in-memory jobstore; jobs are idempotent so a restart simply re-runs them on the
next tick.
"""
from __future__ import annotations

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.scheduler.jobs import register_jobs

logger = structlog.get_logger()

_scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    global _scheduler
    if not get_settings().RUN_SCHEDULER:
        logger.info("scheduler_disabled")
        return
    if _scheduler and _scheduler.running:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    register_jobs(_scheduler)
    _scheduler.start()
    logger.info("scheduler_started", jobs=[j.id for j in _scheduler.get_jobs()])


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")
    _scheduler = None
