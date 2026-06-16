"""
schedule_service — doctor availability + slot generation.

Pure slot math (`build_day_slots`) is separated from DB access so it can be
unit-tested without a database. DB-facing functions fetch rows then delegate.
"""
from __future__ import annotations

from datetime import date, time, timedelta
from typing import Any, Optional

from app.database import get_supabase_admin
from app.config import get_settings
from app.utils.timezone import add_minutes, hhmmss, parse_time

ACTIVE_APT_STATUSES = ["scheduled", "confirmed", "checked_in", "in_progress", "completed"]


def _dow(d: date) -> int:
    """Python Mon=0..Sun=6  ->  DB Sun=0..Sat=6."""
    return (d.weekday() + 1) % 7


def _overlaps_break(slot_start: time, slot_end: time, b_start: Optional[time], b_end: Optional[time]) -> bool:
    if not b_start or not b_end:
        return False
    return slot_start < b_end and slot_end > b_start


def build_day_slots(
    target_date: date,
    weekly_rows: list[dict],
    override: Optional[dict],
    booked_starts: set[str],
    *,
    include_unavailable: bool = False,
    default_slot_minutes: int = 30,
) -> list[dict]:
    """Pure function — generate slots for a single date."""
    if override and override.get("is_available") is False:
        return []

    windows: list[dict] = []
    if override and override.get("is_available") is True and override.get("start_time") and override.get("end_time"):
        windows.append({
            "start_time": parse_time(override["start_time"]),
            "end_time":   parse_time(override["end_time"]),
            "slot_duration_minutes": default_slot_minutes,
            "break_start": None,
            "break_end":   None,
        })
    else:
        for row in weekly_rows:
            if row.get("is_active") is False:
                continue
            ef = row.get("effective_from")
            eu = row.get("effective_until")
            if ef and target_date < date.fromisoformat(str(ef)):
                continue
            if eu and target_date > date.fromisoformat(str(eu)):
                continue
            windows.append({
                "start_time": parse_time(row["start_time"]),
                "end_time":   parse_time(row["end_time"]),
                "slot_duration_minutes": row.get("slot_duration_minutes") or default_slot_minutes,
                "break_start": parse_time(row["break_start"]) if row.get("break_start") else None,
                "break_end":   parse_time(row["break_end"]) if row.get("break_end") else None,
            })

    slots: list[dict] = []
    for w in windows:
        dur = int(w["slot_duration_minutes"])
        cursor = w["start_time"]
        while True:
            slot_end = add_minutes(cursor, dur)
            if slot_end > w["end_time"] or slot_end <= cursor:
                break
            if not _overlaps_break(cursor, slot_end, w["break_start"], w["break_end"]):
                start_str = hhmmss(cursor)
                is_avail = start_str not in booked_starts
                if is_avail or include_unavailable:
                    slots.append({
                        "date":                target_date.isoformat(),
                        "start_time":          start_str,
                        "end_time":            hhmmss(slot_end),
                        "is_available":        is_avail,
                        "slot_duration_minutes": dur,
                    })
            cursor = slot_end

    slots.sort(key=lambda s: s["start_time"])
    return slots


# --------------------------------------------------------------------------- #
# DB-facing
# --------------------------------------------------------------------------- #

async def generate_slots(
    doctor_id: str,
    clinic_id: Optional[str],
    date_from: date,
    date_to: date,
    *,
    include_unavailable: bool = False,
) -> list[dict]:
    admin = get_supabase_admin()

    weekly = (await admin.table("doctor_weekly_schedules").select("*").eq(
        "doctor_id", doctor_id
    ).eq("is_active", True).execute()).data or []
    weekly_by_dow: dict[int, list[dict]] = {}
    for row in weekly:
        weekly_by_dow.setdefault(row["day_of_week"], []).append(row)

    overrides = (await admin.table("doctor_schedule_overrides").select("*").eq(
        "doctor_id", doctor_id
    ).gte("override_date", date_from.isoformat()).lte(
        "override_date", date_to.isoformat()
    ).execute()).data or []
    override_by_date = {str(o["override_date"]): o for o in overrides}

    booked = (await admin.table("appointments").select("appointment_date, start_time").eq(
        "doctor_id", doctor_id
    ).gte("appointment_date", date_from.isoformat()).lte(
        "appointment_date", date_to.isoformat()
    ).in_("status", ACTIVE_APT_STATUSES).execute()).data or []
    booked_by_date: dict[str, set[str]] = {}
    for b in booked:
        booked_by_date.setdefault(str(b["appointment_date"]), set()).add(hhmmss(parse_time(b["start_time"])))

    out: list[dict] = []
    cur = date_from
    while cur <= date_to:
        rows = weekly_by_dow.get(_dow(cur), [])
        override = override_by_date.get(cur.isoformat())
        out.extend(build_day_slots(
            cur, rows, override,
            booked_by_date.get(cur.isoformat(), set()),
            include_unavailable=include_unavailable,
            default_slot_minutes=get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES,
        ))
        cur += timedelta(days=1)
    return out


async def is_slot_available(doctor_id: str, appointment_date: date, start_time: time) -> bool:
    """True if the slot exists in the doctor's schedule and is not already booked."""
    slots = await generate_slots(doctor_id, None, appointment_date, appointment_date, include_unavailable=False)
    target = hhmmss(start_time)
    return any(s["start_time"] == target for s in slots)


async def get_slot_duration(doctor_id: str, appointment_date: date, start_time: time) -> int:
    """Return the slot duration (minutes) for the matching weekly window, or the default."""
    admin = get_supabase_admin()
    rows = (await admin.table("doctor_weekly_schedules").select(
        "day_of_week, start_time, end_time, slot_duration_minutes, is_active"
    ).eq("doctor_id", doctor_id).eq("is_active", True).execute()).data or []
    dow = _dow(appointment_date)
    for r in rows:
        if r["day_of_week"] == dow:
            st = parse_time(r["start_time"]); et = parse_time(r["end_time"])
            if st <= start_time < et:
                return int(r.get("slot_duration_minutes") or get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES)
    return get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES


async def check_slot(
    doctor_id: str, appointment_date: date, start_time: time
) -> tuple[bool, int]:
    """Return (is_available, duration_minutes) in a single generate_slots call.

    Replaces calling is_slot_available + get_slot_duration separately, which
    would hit doctor_weekly_schedules twice.
    """
    slots = await generate_slots(
        doctor_id, None, appointment_date, appointment_date, include_unavailable=True
    )
    target = hhmmss(start_time)
    for s in slots:
        if s["start_time"] == target:
            return s["is_available"], int(s.get("slot_duration_minutes") or get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES)
    return False, get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES


ALLOWED_SLOT_DURATIONS = {60, 90, 120}


async def upsert_weekly_schedule(doctor_id: str, clinic_id: str, items: list[dict]) -> list[dict]:
    """Replace a doctor's weekly schedule atomically (delete-then-insert)."""
    from app.utils.exceptions import BadRequestError
    for it in items:
        dur = it.get("slot_duration_minutes", get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES)
        if dur not in ALLOWED_SLOT_DURATIONS:
            raise BadRequestError(f"slot_duration_minutes must be one of {sorted(ALLOWED_SLOT_DURATIONS)}, got {dur}")

    admin = get_supabase_admin()
    await admin.table("doctor_weekly_schedules").delete().eq("doctor_id", doctor_id).execute()
    rows = [{
        "doctor_id": doctor_id,
        "clinic_id": clinic_id,
        "day_of_week": it["day_of_week"],
        "start_time": str(it["start_time"]),
        "end_time": str(it["end_time"]),
        "slot_duration_minutes": it.get("slot_duration_minutes", get_settings().APPOINTMENT_DEFAULT_SLOT_MINUTES),
        "break_start": str(it["break_start"]) if it.get("break_start") else None,
        "break_end": str(it["break_end"]) if it.get("break_end") else None,
        "is_active": it.get("is_active", True),
        "effective_from": str(it["effective_from"]) if it.get("effective_from") else None,
        "effective_until": str(it["effective_until"]) if it.get("effective_until") else None,
    } for it in items]
    if not rows:
        return []
    return (await admin.table("doctor_weekly_schedules").insert(rows).execute()).data or []


async def add_override(doctor_id: str, clinic_id: str, payload: dict, created_by: str) -> dict:
    admin = get_supabase_admin()
    row = {
        "doctor_id": doctor_id,
        "clinic_id": clinic_id,
        "override_date": str(payload["override_date"]),
        "is_available": payload.get("is_available", False),
        "start_time": str(payload["start_time"]) if payload.get("start_time") else None,
        "end_time": str(payload["end_time"]) if payload.get("end_time") else None,
        "reason": payload.get("reason"),
        "created_by": created_by,
    }
    res = await admin.table("doctor_schedule_overrides").upsert(
        row, on_conflict="doctor_id,override_date"
    ).execute()
    return res.data[0] if res.data else {}


async def remove_override(doctor_id: str, override_id: str) -> None:
    admin = get_supabase_admin()
    await admin.table("doctor_schedule_overrides").delete().eq(
        "override_id", override_id
    ).eq("doctor_id", doctor_id).execute()
