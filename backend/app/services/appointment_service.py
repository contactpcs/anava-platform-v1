"""
appointment_service — booking lifecycle + conflict handling.

All authorization is enforced here (the routers add a coarse role guard, this
layer enforces ownership / clinic / timing rules). Patients can only cancel
their own appointment (>= min hours before start); they can never create or
directly reschedule — that goes through request_service.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone, date, time
from typing import Optional

from app.database import get_supabase_admin
from app.config import get_settings
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError, ConflictError
from app.utils.timezone import local_to_utc, add_minutes, hhmmss, parse_time
from app.services import schedule_service
from app.socket_io import emitter

STAFF_ROLES = {"doctor", "receptionist", "clinical_assistant", "admin"}
ACTIVE_STATUSES = {"scheduled", "confirmed", "checked_in", "in_progress"}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

async def _name_map(admin, ids: list[str]) -> dict[str, str]:
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    rows = (await admin.table("profiles").select("id, full_name").in_("id", ids).execute()).data or []
    return {r["id"]: r["full_name"] for r in rows}


async def _hydrate(admin, row: dict) -> dict:
    names = await _name_map(admin, [row.get("patient_id"), row.get("doctor_id")])
    row["patient_name"] = names.get(row.get("patient_id"))
    row["doctor_name"] = names.get(row.get("doctor_id"))
    return row


async def _record_history(admin, entity_id: str, action: str, current_user: dict,
                    old_status: Optional[str] = None, new_status: Optional[str] = None,
                    metadata: Optional[dict] = None, notes: Optional[str] = None) -> None:
    await admin.table("appointment_history").insert({
        "entity_type": "appointment",
        "entity_id": entity_id,
        "action": action,
        "old_status": old_status,
        "new_status": new_status,
        "changed_by": current_user["id"],
        "changed_by_role": current_user["role"],
        "metadata": metadata or {},
        "notes": notes,
    }).execute()


async def _notify(admin, user_id: str, ntype: str, title: str, body: str, metadata: dict) -> None:
    if not user_id:
        return
    await _notify_many(admin, [user_id], ntype, title, body, metadata)


async def _notify_many(admin, user_ids: list, ntype: str, title: str, body: str, metadata: dict) -> None:
    """Batch-insert notifications for multiple users in one DB round-trip."""
    rows = [{"user_id": uid, "type": ntype, "title": title, "body": body, "metadata": metadata}
            for uid in user_ids if uid]
    if not rows:
        return
    res = await admin.table("notifications").insert(rows).execute()
    for saved in (res.data or rows):
        emitter.fire(emitter.emit_notification(saved["user_id"], saved))


async def _load(admin, appointment_id: str) -> dict:
    rows = (await admin.table("appointments").select("*").eq(
        "appointment_id", appointment_id
    ).limit(1).execute()).data or []
    if not rows:
        raise NotFoundError("Appointment not found")
    return rows[0]


def _hours_until(start_at: str) -> float:
    dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt - datetime.now(timezone.utc)).total_seconds() / 3600.0


# --------------------------------------------------------------------------- #
# Create
# --------------------------------------------------------------------------- #

async def create_appointment(payload, *, current_user: dict) -> dict:
    role = current_user["role"]
    if role not in STAFF_ROLES:
        raise ForbiddenError("Patients cannot create appointments directly. Submit an appointment request instead.")

    admin = get_supabase_admin()

    patient_res, doctor_res = await asyncio.gather(
        admin.table("patients").select("id, clinic_id").eq("id", payload.patient_id).limit(1).execute(),
        admin.table("doctors").select("id, clinic_id").eq("id", payload.doctor_id).limit(1).execute(),
    )
    patient = patient_res.data or []
    doctor  = doctor_res.data or []

    if not patient:
        raise NotFoundError("Patient not found")
    clinic_id = patient[0].get("clinic_id")

    user_clinic = current_user.get("clinic_id")
    if user_clinic and clinic_id and user_clinic != clinic_id:
        raise ForbiddenError("Patient does not belong to your clinic")

    if not doctor:
        raise NotFoundError("Doctor not found")
    if clinic_id and doctor[0].get("clinic_id") and doctor[0]["clinic_id"] != clinic_id:
        raise BadRequestError("Doctor and patient belong to different clinics")

    appt_date: date = payload.appointment_date
    start_t: time = payload.start_time

    slot_available, duration = await schedule_service.check_slot(payload.doctor_id, appt_date, start_t)
    if not slot_available:
        raise ConflictError("That slot is not available on the doctor's schedule")

    end_t = add_minutes(start_t, duration)

    row = {
        "clinic_id": clinic_id,
        "patient_id": payload.patient_id,
        "doctor_id": payload.doctor_id,
        "booked_by": current_user["id"],
        "booked_by_role": role,
        "appointment_request_id": payload.appointment_request_id,
        "appointment_date": appt_date.isoformat(),
        "start_time": hhmmss(start_t),
        "end_time": hhmmss(end_t),
        "start_at": local_to_utc(appt_date, start_t).isoformat(),
        "end_at": local_to_utc(appt_date, end_t).isoformat(),
        "status": "scheduled",
        "appointment_type": payload.appointment_type,
        "reason": payload.reason,
        "notes": payload.notes,
        "patient_complaint": payload.patient_complaint,
    }

    try:
        res = await admin.table("appointments").insert(row).execute()
    except Exception as e:
        msg = str(e).lower()
        if "uq_doctor_slot" in msg or "duplicate" in msg or "unique" in msg:
            raise ConflictError("This slot was just booked by someone else. Please choose another slot.")
        raise BadRequestError(f"Could not create appointment: {e}")

    appt = res.data[0]
    await _record_history(admin, appt["appointment_id"], "created", current_user, new_status="scheduled")

    meta = {"appointment_id": appt["appointment_id"], "appointment_date": row["appointment_date"], "start_time": row["start_time"]}
    await _notify(admin, payload.patient_id, "appointment_created", "Appointment Scheduled",
            f"An appointment was booked for {row['appointment_date']} at {row['start_time'][:5]}.", meta)
    await _notify(admin, payload.doctor_id, "appointment_created", "New Appointment",
            f"New appointment on {row['appointment_date']} at {row['start_time'][:5]}.", meta)

    out = await _hydrate(admin, appt)
    await emitter.emit_appointment_event(
        "appointment:created", {"appointment": out},
        clinic_id=clinic_id, patient_id=payload.patient_id, doctor_id=payload.doctor_id,
    )
    return out


# --------------------------------------------------------------------------- #
# Cancel
# --------------------------------------------------------------------------- #

async def cancel_appointment(appointment_id: str, payload, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    appt = await _load(admin, appointment_id)
    role = current_user["role"]

    if appt["status"] not in ACTIVE_STATUSES:
        raise BadRequestError(f"Cannot cancel an appointment in '{appt['status']}' status")

    if role == "patient":
        if appt["patient_id"] != current_user["id"]:
            raise ForbiddenError("Not your appointment")
        min_h = get_settings().APPOINTMENT_CANCEL_MIN_HOURS
        if _hours_until(appt["start_at"]) < min_h:
            raise BadRequestError(f"Appointments can only be cancelled at least {min_h:g} hours before the start time")
    elif role == "doctor":
        if appt["doctor_id"] != current_user["id"]:
            raise ForbiddenError("Not your appointment")
    elif role in STAFF_ROLES:
        if current_user.get("clinic_id") and appt.get("clinic_id") != current_user["clinic_id"]:
            raise ForbiddenError("Appointment is not in your clinic")
    else:
        raise ForbiddenError("Not allowed to cancel appointments")

    res = await admin.table("appointments").update({
        "status": "cancelled",
        "cancelled_by": current_user["id"],
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
        "cancellation_reason": payload.cancellation_reason,
    }).eq("appointment_id", appointment_id).execute()
    appt = res.data[0]

    await _record_history(admin, appointment_id, "cancelled", current_user,
                    old_status="scheduled", new_status="cancelled", notes=payload.cancellation_reason)

    other = appt["doctor_id"] if role == "patient" else appt["patient_id"]
    await _notify(admin, other, "appointment_cancelled", "Appointment Cancelled",
            f"Appointment on {appt['appointment_date']} at {str(appt['start_time'])[:5]} was cancelled.",
            {"appointment_id": appointment_id})

    out = await _hydrate(admin, appt)
    await emitter.emit_appointment_event(
        "appointment:cancelled",
        {"appointment_id": appointment_id, "cancelled_by": current_user["id"],
         "cancelled_by_role": role, "reason": payload.cancellation_reason},
        clinic_id=appt.get("clinic_id"), patient_id=appt["patient_id"], doctor_id=appt["doctor_id"],
    )
    return out


# --------------------------------------------------------------------------- #
# Direct reschedule (staff/doctor only)
# --------------------------------------------------------------------------- #

async def reschedule_appointment_direct(appointment_id: str, payload, *, current_user: dict) -> dict:
    role = current_user["role"]
    if role == "patient":
        raise ForbiddenError("Patients must submit a reschedule request, not reschedule directly")
    if role not in STAFF_ROLES:
        raise ForbiddenError("Not allowed to reschedule")

    admin = get_supabase_admin()
    old = await _load(admin, appointment_id)
    if old["status"] not in ACTIVE_STATUSES:
        raise BadRequestError(f"Cannot reschedule an appointment in '{old['status']}' status")
    if role == "doctor" and old["doctor_id"] != current_user["id"]:
        raise ForbiddenError("Not your appointment")
    if current_user.get("clinic_id") and old.get("clinic_id") != current_user["clinic_id"]:
        raise ForbiddenError("Appointment is not in your clinic")

    from app.models.appointment import AppointmentCreate
    new_appt = await create_appointment(
        AppointmentCreate(
            patient_id=old["patient_id"],
            doctor_id=old["doctor_id"],
            appointment_date=payload.appointment_date,
            start_time=payload.start_time,
            appointment_type=old.get("appointment_type", "consultation"),
            reason=payload.reason or old.get("reason"),
            patient_complaint=old.get("patient_complaint"),
        ),
        current_user=current_user,
    )

    await admin.table("appointments").update({
        "status": "rescheduled",
        "rescheduled_to": new_appt["appointment_id"],
    }).eq("appointment_id", appointment_id).execute()
    await admin.table("appointments").update({
        "rescheduled_from": appointment_id,
    }).eq("appointment_id", new_appt["appointment_id"]).execute()

    await _record_history(admin, appointment_id, "rescheduled", current_user,
                    old_status=old["status"], new_status="rescheduled",
                    metadata={"rescheduled_to": new_appt["appointment_id"]})

    await _notify(admin, old["patient_id"], "appointment_rescheduled", "Appointment Rescheduled",
            f"Your appointment moved to {new_appt['appointment_date']} at {str(new_appt['start_time'])[:5]}.",
            {"old_appointment_id": appointment_id, "new_appointment_id": new_appt["appointment_id"]})

    new_appt["rescheduled_from"] = appointment_id
    await emitter.emit_appointment_event(
        "appointment:rescheduled",
        {"old_appointment_id": appointment_id, "new_appointment": new_appt},
        clinic_id=old.get("clinic_id"), patient_id=old["patient_id"], doctor_id=old["doctor_id"],
    )
    return new_appt


# --------------------------------------------------------------------------- #
# Simple status transitions
# --------------------------------------------------------------------------- #

def _staff_or_doctor_guard(appt: dict, current_user: dict, *, doctor_only: bool = False) -> None:
    role = current_user["role"]
    if role == "patient":
        raise ForbiddenError("Not allowed")
    if doctor_only and role not in ("doctor", "admin"):
        raise ForbiddenError("Only the doctor can perform this action")
    if role == "doctor" and appt["doctor_id"] != current_user["id"]:
        raise ForbiddenError("Not your appointment")
    if role in STAFF_ROLES and current_user.get("clinic_id") and appt.get("clinic_id") != current_user["clinic_id"]:
        raise ForbiddenError("Appointment is not in your clinic")


async def _transition(appointment_id: str, new_status: str, action: str, *,
                      current_user: dict, doctor_only: bool = False,
                      event: str = "appointment:updated") -> dict:
    admin = get_supabase_admin()
    appt = await _load(admin, appointment_id)
    _staff_or_doctor_guard(appt, current_user, doctor_only=doctor_only)
    old_status = appt["status"]
    res = await admin.table("appointments").update({"status": new_status}).eq(
        "appointment_id", appointment_id
    ).execute()
    appt = res.data[0]
    await _record_history(admin, appointment_id, action, current_user, old_status=old_status, new_status=new_status)
    out = await _hydrate(admin, appt)
    await emitter.emit_appointment_event(
        event, {"appointment_id": appointment_id, "status": new_status, "appointment": out},
        clinic_id=appt.get("clinic_id"), patient_id=appt["patient_id"], doctor_id=appt["doctor_id"],
    )
    return out


async def confirm_appointment(appointment_id: str, *, current_user: dict) -> dict:
    appt = await _transition(appointment_id, "confirmed", "confirmed", current_user=current_user,
                             event="appointment:confirmed")
    admin = get_supabase_admin()
    await _notify(admin, appt["patient_id"], "appointment_confirmed", "Appointment Confirmed",
            f"Your appointment on {appt['appointment_date']} is confirmed.", {"appointment_id": appointment_id})
    return appt


async def check_in_appointment(appointment_id: str, *, current_user: dict) -> dict:
    return await _transition(appointment_id, "checked_in", "checked_in", current_user=current_user,
                             event="appointment:checked_in")


async def start_appointment(appointment_id: str, *, current_user: dict) -> dict:
    return await _transition(appointment_id, "in_progress", "started", current_user=current_user,
                             doctor_only=True, event="appointment:updated")


async def complete_appointment(appointment_id: str, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    appt = await _load(admin, appointment_id)
    _staff_or_doctor_guard(appt, current_user, doctor_only=True)

    session_id = appt.get("session_id")
    if not session_id:
        sess = await admin.table("sessions").insert({
            "patient_id": appt["patient_id"],
            "doctor_id": appt["doctor_id"],
            "session_type": "in_person",
            "status": "completed",
            "appointment_id": appointment_id,
            **({"clinic_id": appt["clinic_id"]} if appt.get("clinic_id") else {}),
        }).execute()
        session_id = sess.data[0]["id"] if sess.data else None

    res = await admin.table("appointments").update({
        "status": "completed", "session_id": session_id,
    }).eq("appointment_id", appointment_id).execute()
    appt = res.data[0]
    await _record_history(admin, appointment_id, "completed", current_user,
                    old_status="in_progress", new_status="completed",
                    metadata={"session_id": session_id})
    await _notify(admin, appt["patient_id"], "appointment_completed", "Appointment Completed",
            "Your consultation has been marked complete.", {"appointment_id": appointment_id})
    out = await _hydrate(admin, appt)
    await emitter.emit_appointment_event(
        "appointment:completed", {"appointment_id": appointment_id, "session_id": session_id},
        clinic_id=appt.get("clinic_id"), patient_id=appt["patient_id"], doctor_id=appt["doctor_id"],
    )
    return out


async def mark_no_show(appointment_id: str, *, current_user: dict) -> dict:
    return await _transition(appointment_id, "no_show", "no_show", current_user=current_user,
                             event="appointment:no_show")


async def update_appointment(appointment_id: str, payload, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    appt = await _load(admin, appointment_id)
    _staff_or_doctor_guard(appt, current_user)
    updates = {k: v for k, v in {
        "notes": payload.notes,
        "patient_complaint": payload.patient_complaint,
        "appointment_type": payload.appointment_type,
    }.items() if v is not None}
    if not updates:
        raise BadRequestError("No fields to update")
    res = await admin.table("appointments").update(updates).eq("appointment_id", appointment_id).execute()
    appt = res.data[0]
    await _record_history(admin, appointment_id, "notes_updated", current_user, metadata=updates)
    out = await _hydrate(admin, appt)
    await emitter.emit_appointment_event(
        "appointment:updated", {"appointment_id": appointment_id, "changes": updates},
        clinic_id=appt.get("clinic_id"), patient_id=appt["patient_id"], doctor_id=appt["doctor_id"],
    )
    return out


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #

async def get_appointment(appointment_id: str, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    appt = await _load(admin, appointment_id)
    role = current_user["role"]
    if role == "patient" and appt["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your appointment")
    if role == "doctor" and appt["doctor_id"] != current_user["id"]:
        if current_user.get("clinic_id") and appt.get("clinic_id") != current_user["clinic_id"]:
            raise ForbiddenError("Not your appointment")
    if role in ("receptionist", "clinical_assistant") and current_user.get("clinic_id") \
            and appt.get("clinic_id") != current_user["clinic_id"]:
        raise ForbiddenError("Appointment is not in your clinic")
    return await _hydrate(admin, appt)


async def list_appointments(*, current_user: dict,
                      date_from: Optional[date] = None, date_to: Optional[date] = None,
                      status: Optional[str] = None,
                      doctor_id: Optional[str] = None, patient_id: Optional[str] = None,
                      skip: int = 0, limit: int = 20) -> list[dict]:
    admin = get_supabase_admin()
    role = current_user["role"]
    q = admin.table("appointments").select("*")

    if role == "patient":
        q = q.eq("patient_id", current_user["id"])
    elif role == "doctor":
        q = q.eq("doctor_id", current_user["id"])
    else:
        if current_user.get("clinic_id"):
            q = q.eq("clinic_id", current_user["clinic_id"])
        if doctor_id:
            q = q.eq("doctor_id", doctor_id)
        if patient_id:
            q = q.eq("patient_id", patient_id)

    if status:
        q = q.eq("status", status)
    if date_from:
        q = q.gte("appointment_date", date_from.isoformat())
    if date_to:
        q = q.lte("appointment_date", date_to.isoformat())

    rows = (await q.order("start_at", desc=False).range(skip, skip + limit - 1).execute()).data or []

    names = await _name_map(admin, [r.get("patient_id") for r in rows] + [r.get("doctor_id") for r in rows])
    for r in rows:
        r["patient_name"] = names.get(r.get("patient_id"))
        r["doctor_name"] = names.get(r.get("doctor_id"))
    return rows


async def get_history(appointment_id: str, *, current_user: dict) -> list[dict]:
    await get_appointment(appointment_id, current_user=current_user)
    admin = get_supabase_admin()
    return (await admin.table("appointment_history").select("*").eq(
        "entity_type", "appointment"
    ).eq("entity_id", appointment_id).order("changed_at", desc=True).execute()).data or []
