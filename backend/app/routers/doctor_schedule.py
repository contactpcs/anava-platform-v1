from datetime import date, time, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from app.dependencies import require_doctor, require_staff, require_staff_or_doctor, require_admin
from app.database import get_supabase_admin
from app.services import schedule_service
from app.utils.responses import success_response
from app.utils.exceptions import BadRequestError, ForbiddenError
from app.limiter import limiter

router = APIRouter()


class WeeklyScheduleItem(BaseModel):
    day_of_week: int
    start_time: time
    end_time: time
    slot_duration_minutes: int = 60
    break_start: Optional[time] = None
    break_end: Optional[time] = None
    is_active: bool = True
    effective_from: Optional[date] = None
    effective_until: Optional[date] = None


class WeeklyScheduleUpsert(BaseModel):
    items: List[WeeklyScheduleItem]


class ScheduleOverrideCreate(BaseModel):
    override_date: date
    is_available: bool = False
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    reason: Optional[str] = None


@router.get("/my")
@limiter.limit("60/minute")
async def my_schedule(request: Request, current_user: dict = Depends(require_doctor)):
    admin = get_supabase_admin()
    doctor_id = current_user["id"]
    weekly = (await admin.table("doctor_weekly_schedules").select("*").eq(
        "doctor_id", doctor_id
    ).order("day_of_week").execute()).data or []
    today = date.today()
    overrides = (await admin.table("doctor_schedule_overrides").select("*").eq(
        "doctor_id", doctor_id
    ).gte("override_date", today.isoformat()).order("override_date").execute()).data or []
    return success_response({"weekly": weekly, "overrides": overrides})


@router.put("/my")
@limiter.limit("20/minute")
async def replace_my_schedule(request: Request, body: WeeklyScheduleUpsert,
                              current_user: dict = Depends(require_doctor)):
    clinic_id = current_user.get("clinic_id")
    if not clinic_id:
        raise BadRequestError("Your account is not associated with a clinic")
    rows = await schedule_service.upsert_weekly_schedule(
        current_user["id"], clinic_id, [it.model_dump() for it in body.items]
    )
    return success_response(rows, "Weekly schedule updated")


@router.post("/my/overrides")
@limiter.limit("20/minute")
async def add_my_override(request: Request, body: ScheduleOverrideCreate,
                          current_user: dict = Depends(require_doctor)):
    clinic_id = current_user.get("clinic_id")
    if not clinic_id:
        raise BadRequestError("Your account is not associated with a clinic")
    row = await schedule_service.add_override(current_user["id"], clinic_id, body.model_dump(), current_user["id"])
    return success_response(row, "Override added", status_code=201)


@router.delete("/my/overrides/{override_id}")
@limiter.limit("20/minute")
async def delete_my_override(request: Request, override_id: str,
                             current_user: dict = Depends(require_doctor)):
    await schedule_service.remove_override(current_user["id"], override_id)
    return success_response({"override_id": override_id}, "Override removed")


@router.get("/doctor/{doctor_id}")
@limiter.limit("60/minute")
async def doctor_schedule(request: Request, doctor_id: str,
                          current_user: dict = Depends(require_staff_or_doctor)):
    admin = get_supabase_admin()
    if current_user.get("role") != "admin" or current_user.get("clinic_id"):
        await _assert_same_clinic(admin, doctor_id, current_user)
    weekly = (await admin.table("doctor_weekly_schedules").select("*").eq(
        "doctor_id", doctor_id
    ).order("day_of_week").execute()).data or []
    from datetime import date as _date
    overrides = (await admin.table("doctor_schedule_overrides").select("*").eq(
        "doctor_id", doctor_id
    ).gte("override_date", _date.today().isoformat()).order("override_date").execute()).data or []
    return success_response({"weekly": weekly, "overrides": overrides})


@router.get("/doctor/{doctor_id}/slots")
@limiter.limit("60/minute")
async def doctor_slots(
    request: Request,
    doctor_id: str,
    from_date: date = Query(...),
    to_date: Optional[date] = None,
    include_unavailable: bool = False,
    current_user: dict = Depends(require_staff_or_doctor),
):
    admin = get_supabase_admin()
    await _assert_same_clinic(admin, doctor_id, current_user)
    if to_date is None:
        to_date = from_date
    if to_date < from_date:
        raise BadRequestError("to_date must be on or after from_date")
    slots = await schedule_service.generate_slots(
        doctor_id, current_user.get("clinic_id"), from_date, to_date,
        include_unavailable=include_unavailable,
    )
    return success_response(slots)


@router.get("/clinic/doctors")
@limiter.limit("60/minute")
async def clinic_doctors(request: Request, current_user: dict = Depends(require_staff)):
    admin = get_supabase_admin()
    clinic_id = current_user.get("clinic_id")
    q = admin.table("profiles").select("id, full_name, email").eq("role", "doctor").eq("is_active", True)
    if clinic_id:
        q = q.eq("clinic_id", clinic_id)
    profiles = (await q.execute()).data or []
    ids = [p["id"] for p in profiles]
    doctors = {}
    if ids:
        rows = (await admin.table("doctors").select(
            "id, specialization, availability, current_patient_count, max_patients"
        ).in_("id", ids).execute()).data or []
        doctors = {d["id"]: d for d in rows}
    return success_response([
        {**p, **doctors.get(p["id"], {})} for p in profiles
    ])


# ── Admin-on-behalf: write any doctor's schedule + overrides ─────────────

async def _resolve_doctor_clinic(admin, doctor_id: str) -> str:
    rows = (await admin.table("doctors").select("clinic_id").eq("id", doctor_id).limit(1).execute()).data or []
    if not rows:
        raise BadRequestError("Doctor not found")
    cid = rows[0].get("clinic_id")
    if not cid:
        raise BadRequestError("Target doctor has no clinic")
    return cid


@router.put("/doctor/{doctor_id}")
@limiter.limit("20/minute")
async def admin_replace_doctor_schedule(
    request: Request, doctor_id: str, body: WeeklyScheduleUpsert,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    clinic_id = await _resolve_doctor_clinic(admin, doctor_id)
    rows = await schedule_service.upsert_weekly_schedule(
        doctor_id, clinic_id, [it.model_dump() for it in body.items]
    )
    return success_response(rows, "Weekly schedule updated")


@router.post("/doctor/{doctor_id}/overrides")
@limiter.limit("20/minute")
async def admin_add_doctor_override(
    request: Request, doctor_id: str, body: ScheduleOverrideCreate,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    clinic_id = await _resolve_doctor_clinic(admin, doctor_id)
    row = await schedule_service.add_override(doctor_id, clinic_id, body.model_dump(), current_user["id"])
    return success_response(row, "Override added", status_code=201)


@router.delete("/doctor/{doctor_id}/overrides/{override_id}")
@limiter.limit("20/minute")
async def admin_delete_doctor_override(
    request: Request, doctor_id: str, override_id: str,
    current_user: dict = Depends(require_admin),
):
    await schedule_service.remove_override(doctor_id, override_id)
    return success_response({"override_id": override_id}, "Override removed")


async def _assert_same_clinic(admin, doctor_id: str, current_user: dict) -> None:
    """A doctor may only read their own schedule; staff are limited to their clinic."""
    role = current_user["role"]
    if role == "doctor" and doctor_id != current_user["id"]:
        raise ForbiddenError("Doctors can only view their own schedule")
    clinic_id = current_user.get("clinic_id")
    if clinic_id:
        d = (await admin.table("doctors").select("clinic_id").eq("id", doctor_id).limit(1).execute()).data or []
        if d and d[0].get("clinic_id") and d[0]["clinic_id"] != clinic_id:
            raise ForbiddenError("Doctor is not in your clinic")
