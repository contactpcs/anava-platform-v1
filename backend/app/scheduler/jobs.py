"""Background jobs: appointment reminders, request expiry, no-show cleanup.

Jobs use the async Supabase admin client and best-effort async socket emits.
They are idempotent: reminder columns are stamped after sending, and
expiry/no-show transitions only touch rows still in an actionable status.

Distributed-lock pattern: each job acquires a short-lived Redis key (NX + EX)
before doing any work. Only the first worker that wins the SET gets to run;
the others return immediately. Falls back to always-run if Redis is not
configured (single-worker / dev) or if Redis is unreachable (fail-open).
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta

import structlog
import redis.asyncio as aioredis

from app.database import get_supabase_admin
from app.config import get_settings
from app.socket_io import emitter

logger = structlog.get_logger()

ACTIVE = ["scheduled", "confirmed"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _try_lock(name: str, ttl: int) -> bool:
    """Acquire a Redis distributed lock for one job execution window.

    Returns True  → this worker should run the job.
    Returns False → another worker already holds the lock; skip.
    Fails open    → if Redis is unavailable, every worker runs (safe because
                    jobs are idempotent) rather than silently not running.
    """
    settings = get_settings()
    if not settings.REDIS_URL:
        return True  # single-worker / dev — no lock needed
    try:
        r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        acquired = await r.set(name, "1", nx=True, ex=ttl)
        await r.aclose()
        return bool(acquired)
    except Exception:
        logger.warning("scheduler_lock_redis_unavailable", lock=name)
        return True  # fail open


async def _send_reminder(appt: dict, lead: str) -> None:
    admin = get_supabase_admin()
    meta = {"appointment_id": appt["appointment_id"], "lead_time": lead}
    for uid in (appt.get("patient_id"), appt.get("doctor_id")):
        if uid:
            await admin.table("notifications").insert({
                "user_id": uid,
                "type": f"appointment_reminder_{lead}",
                "title": "Appointment Reminder",
                "body": f"Reminder: appointment on {appt['appointment_date']} at {str(appt['start_time'])[:5]} ({lead} before).",
                "metadata": meta,
            }).execute()
            await emitter._safe_emit("appointment:reminder", {"appointment": appt, "lead_time": lead}, f"user:{uid}")


async def dispatch_reminders() -> None:
    # TTL = 270s (4.5 min) — slightly less than the 5-min job interval
    if not await _try_lock("sched:lock:reminders", 270):
        logger.debug("scheduler_lock_skip", job="dispatch_reminders")
        return
    settings = get_settings()
    admin = get_supabase_admin()
    now = _now()

    if settings.APPOINTMENT_REMINDER_24H_ENABLED:
        rows = (await admin.table("appointments").select("*").in_("status", ACTIVE).is_(
            "reminder_24h_sent_at", "null"
        ).gte("start_at", _iso(now)).lte("start_at", _iso(now + timedelta(hours=24))).execute()).data or []
        for appt in rows:
            await admin.table("appointments").update({"reminder_24h_sent_at": _iso(now)}).eq(
                "appointment_id", appt["appointment_id"]
            ).execute()
            await _send_reminder(appt, "24h")

    if settings.APPOINTMENT_REMINDER_1H_ENABLED:
        rows = (await admin.table("appointments").select("*").in_("status", ACTIVE).is_(
            "reminder_1h_sent_at", "null"
        ).gte("start_at", _iso(now)).lte("start_at", _iso(now + timedelta(hours=1))).execute()).data or []
        for appt in rows:
            await admin.table("appointments").update({"reminder_1h_sent_at": _iso(now)}).eq(
                "appointment_id", appt["appointment_id"]
            ).execute()
            await _send_reminder(appt, "1h")


async def expire_stale_requests() -> None:
    # TTL = 1700s (28 min) — slightly less than the 30-min job interval
    if not await _try_lock("sched:lock:expiry", 1700):
        logger.debug("scheduler_lock_skip", job="expire_stale_requests")
        return
    admin = get_supabase_admin()
    now = _now()
    rows = (await admin.table("appointment_requests").select(
        "request_id, clinic_id, patient_id"
    ).eq("status", "pending").lt("expires_at", _iso(now)).execute()).data or []
    for req in rows:
        await admin.table("appointment_requests").update({"status": "expired"}).eq(
            "request_id", req["request_id"]
        ).execute()
        await admin.table("appointment_history").insert({
            "entity_type": "request", "entity_id": req["request_id"],
            "action": "request_expired", "old_status": "pending", "new_status": "expired",
            "changed_by": req["patient_id"], "changed_by_role": "system",
        }).execute()
        await emitter.emit_request_event(
            "appointment_request:expired", {"request_id": req["request_id"]},
            clinic_id=req.get("clinic_id"), patient_id=req.get("patient_id"),
        )
    if rows:
        logger.info("requests_expired", count=len(rows))


async def cleanup_no_shows() -> None:
    # TTL = 82800s (23h) — daily cron job, one run per day is enough
    if not await _try_lock("sched:lock:no_shows", 82800):
        logger.debug("scheduler_lock_skip", job="cleanup_no_shows")
        return
    admin = get_supabase_admin()
    cutoff = _now() - timedelta(hours=2)
    rows = (await admin.table("appointments").select(
        "appointment_id, clinic_id, patient_id, doctor_id"
    ).in_("status", ACTIVE).lt("end_at", _iso(cutoff)).execute()).data or []
    for appt in rows:
        await admin.table("appointments").update({"status": "no_show"}).eq(
            "appointment_id", appt["appointment_id"]
        ).execute()
        await admin.table("appointment_history").insert({
            "entity_type": "appointment", "entity_id": appt["appointment_id"],
            "action": "no_show", "new_status": "no_show",
            "changed_by": appt["patient_id"], "changed_by_role": "system",
        }).execute()
        await emitter.emit_appointment_event(
            "appointment:no_show", {"appointment_id": appt["appointment_id"], "flagged_by": "system"},
            clinic_id=appt.get("clinic_id"), patient_id=appt.get("patient_id"), doctor_id=appt.get("doctor_id"),
        )
    if rows:
        logger.info("no_shows_flagged", count=len(rows))


def register_jobs(sched) -> None:
    sched.add_job(dispatch_reminders, trigger="interval", minutes=5,
                  id="reminder_dispatcher", replace_existing=True, coalesce=True, max_instances=1)
    sched.add_job(expire_stale_requests, trigger="interval", minutes=30,
                  id="request_expiry_gc", replace_existing=True, coalesce=True, max_instances=1)
    sched.add_job(cleanup_no_shows, trigger="cron", hour=2, minute=0,
                  id="no_show_cleanup", replace_existing=True, coalesce=True, max_instances=1)
