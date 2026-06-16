"""
request_service — patient appointment requests + receptionist review flow.

Approval delegates to appointment_service.create_appointment so all booking
rules (slot availability, double-booking, history, notifications) are reused.
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

from cachetools import TTLCache

from app.database import get_supabase_admin
from app.config import get_settings
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError, ConflictError
from app.services import appointment_service
from app.models.appointment import AppointmentCreate
from app.socket_io import emitter

REVIEW_ROLES = {"receptionist", "clinical_assistant", "admin"}

_receptionist_cache: TTLCache = TTLCache(maxsize=64, ttl=60)


async def _name_map(admin, ids):
    ids = [i for i in set(ids) if i]
    if not ids:
        return {}
    rows = (await admin.table("profiles").select("id, full_name").in_("id", ids).execute()).data or []
    return {r["id"]: r["full_name"] for r in rows}


async def _hydrate(admin, row: dict, prefetched_names: Optional[dict] = None) -> dict:
    names = prefetched_names or await _name_map(admin, [row.get("patient_id"), row.get("doctor_id"), row.get("reviewed_by")])
    row["patient_name"] = names.get(row.get("patient_id"))
    row["doctor_name"] = names.get(row.get("doctor_id"))
    row["reviewer_name"] = names.get(row.get("reviewed_by"))
    return row


async def _record_history(admin, request_id: str, action: str, current_user: dict,
                    old_status: Optional[str] = None, new_status: Optional[str] = None,
                    metadata: Optional[dict] = None, notes: Optional[str] = None) -> None:
    await admin.table("appointment_history").insert({
        "entity_type": "request",
        "entity_id": request_id,
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


async def _get_clinic_receptionists(admin, clinic_id: str) -> list[dict]:
    if clinic_id in _receptionist_cache:
        return _receptionist_cache[clinic_id]
    rows = (await admin.table("profiles").select("id").eq("role", "receptionist").eq(
        "clinic_id", clinic_id
    ).eq("is_active", True).execute()).data or []
    _receptionist_cache[clinic_id] = rows
    return rows


async def _notify_clinic_reviewers(admin, clinic_id: str, ntype: str, title: str, body: str, metadata: dict) -> None:
    if not clinic_id:
        return
    receptionists = await _get_clinic_receptionists(admin, clinic_id)
    await _notify_many(admin, [r["id"] for r in receptionists], ntype, title, body, metadata)


async def _load(admin, request_id: str) -> dict:
    rows = (await admin.table("appointment_requests").select("*").eq(
        "request_id", request_id
    ).limit(1).execute()).data or []
    if not rows:
        raise NotFoundError("Appointment request not found")
    return rows[0]


def _hours_until(start_at: str) -> float:
    dt = datetime.fromisoformat(start_at.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (dt - datetime.now(timezone.utc)).total_seconds() / 3600.0


# --------------------------------------------------------------------------- #
# Patient: create
# --------------------------------------------------------------------------- #

async def create_new_request(payload, *, current_user: dict) -> dict:
    if current_user["role"] != "patient":
        raise ForbiddenError("Only patients can submit appointment requests")

    admin = get_supabase_admin()
    patient_id = current_user["id"]

    prow = (await admin.table("patients").select("assigned_doctor_id, clinic_id").eq(
        "id", patient_id
    ).limit(1).execute()).data or []
    if not prow:
        raise NotFoundError("Patient profile not found")
    doctor_id = prow[0].get("assigned_doctor_id")
    clinic_id = prow[0].get("clinic_id")
    if not doctor_id:
        raise BadRequestError("Please contact reception — no doctor is assigned to you yet")

    existing = (await admin.table("appointment_requests").select("request_id").eq(
        "patient_id", patient_id
    ).eq("request_type", "new").eq("status", "pending").execute()).data or []
    if existing:
        raise ConflictError("You already have a pending appointment request")

    expiry_h = get_settings().APPOINTMENT_REQUEST_EXPIRY_HOURS
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=expiry_h)).isoformat()

    row = {
        "clinic_id": clinic_id,
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "request_type": "new",
        "preferred_date_1": payload.preferred_date_1.isoformat(),
        "preferred_date_2": payload.preferred_date_2.isoformat() if payload.preferred_date_2 else None,
        "preferred_date_3": payload.preferred_date_3.isoformat() if payload.preferred_date_3 else None,
        "preferred_time_window": payload.preferred_time_window,
        "patient_complaint": payload.patient_complaint,
        "reason": payload.reason,
        "urgency": payload.urgency,
        "status": "pending",
        "expires_at": expires_at,
    }
    req = (await admin.table("appointment_requests").insert(row).execute()).data[0]

    await _record_history(admin, req["request_id"], "request_submitted", current_user, new_status="pending")
    await _notify(admin, patient_id, "appointment_request_submitted", "Request Submitted",
            "Your appointment request has been submitted. The reception team will get back shortly.",
            {"request_id": req["request_id"]})
    await _notify_clinic_reviewers(admin, clinic_id, "appointment_request_submitted", "New Appointment Request",
                             "A patient submitted a new appointment request.", {"request_id": req["request_id"]})
    out = await _hydrate(admin, req)
    await emitter.emit_request_event("appointment_request:created", {"request": out},
                                     clinic_id=clinic_id, patient_id=patient_id)
    return out


async def create_reschedule_request(appointment_id: str, payload, *, current_user: dict) -> dict:
    if current_user["role"] != "patient":
        raise ForbiddenError("Only patients can submit reschedule requests")

    admin = get_supabase_admin()
    appt = (await admin.table("appointments").select("*").eq(
        "appointment_id", appointment_id
    ).limit(1).execute()).data or []
    if not appt:
        raise NotFoundError("Appointment not found")
    appt = appt[0]

    if appt["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your appointment")
    if appt["status"] not in ("scheduled", "confirmed"):
        raise BadRequestError(f"Cannot reschedule an appointment in '{appt['status']}' status")
    min_h = get_settings().APPOINTMENT_RESCHEDULE_MIN_HOURS
    if _hours_until(appt["start_at"]) < min_h:
        raise BadRequestError(f"Reschedule must be requested at least {min_h:g} hours before the start time")

    dup = (await admin.table("appointment_requests").select("request_id").eq(
        "parent_appointment_id", appointment_id
    ).eq("status", "pending").eq("request_type", "reschedule").execute()).data or []
    if dup:
        raise ConflictError("A reschedule request for this appointment is already pending")

    expiry_h = get_settings().APPOINTMENT_REQUEST_EXPIRY_HOURS
    row = {
        "clinic_id": appt.get("clinic_id"),
        "patient_id": appt["patient_id"],
        "doctor_id": appt["doctor_id"],
        "request_type": "reschedule",
        "parent_appointment_id": appointment_id,
        "preferred_date_1": payload.preferred_date_1.isoformat(),
        "preferred_date_2": payload.preferred_date_2.isoformat() if payload.preferred_date_2 else None,
        "preferred_date_3": payload.preferred_date_3.isoformat() if payload.preferred_date_3 else None,
        "preferred_time_window": payload.preferred_time_window,
        "patient_complaint": appt.get("patient_complaint") or "Reschedule request",
        "reason": payload.reason,
        "urgency": "normal",
        "status": "pending",
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=expiry_h)).isoformat(),
    }
    req = (await admin.table("appointment_requests").insert(row).execute()).data[0]

    await _record_history(admin, req["request_id"], "request_submitted", current_user, new_status="pending",
                    metadata={"parent_appointment_id": appointment_id})
    await _notify(admin, appt["patient_id"], "reschedule_request_submitted", "Reschedule Requested",
            "Your reschedule request has been submitted. We'll confirm a new time shortly.",
            {"request_id": req["request_id"]})
    await _notify_clinic_reviewers(admin, appt.get("clinic_id"), "reschedule_request_submitted",
                             "New Reschedule Request", "A patient requested a reschedule.",
                             {"request_id": req["request_id"]})
    out = await _hydrate(admin, req)
    await emitter.emit_request_event("appointment_request:created", {"request": out},
                                     clinic_id=appt.get("clinic_id"), patient_id=appt["patient_id"])
    return out


async def cancel_request(request_id: str, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    req = await _load(admin, request_id)
    if current_user["role"] != "patient" or req["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your request")
    if req["status"] != "pending":
        raise BadRequestError("Only pending requests can be withdrawn")

    res = await admin.table("appointment_requests").update({
        "status": "cancelled_by_patient",
    }).eq("request_id", request_id).execute()
    req = res.data[0]
    await _record_history(admin, request_id, "request_cancelled_by_patient", current_user,
                    old_status="pending", new_status="cancelled_by_patient")
    await _notify_clinic_reviewers(admin, req.get("clinic_id"), "appointment_request_cancelled_by_patient",
                             "Request Withdrawn", "A patient withdrew their appointment request.",
                             {"request_id": request_id})
    out = await _hydrate(admin, req)
    await emitter.emit_request_event("appointment_request:cancelled_by_patient", {"request_id": request_id},
                                     clinic_id=req.get("clinic_id"), patient_id=req["patient_id"])
    return out


# --------------------------------------------------------------------------- #
# Staff: review
# --------------------------------------------------------------------------- #

def _assert_reviewer(req: dict, current_user: dict) -> None:
    if current_user["role"] not in REVIEW_ROLES:
        raise ForbiddenError("Not allowed to review appointment requests")
    if current_user.get("clinic_id") and req.get("clinic_id") != current_user["clinic_id"]:
        raise ForbiddenError("Request is not in your clinic")


async def approve_request(request_id: str, payload, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    req = await _load(admin, request_id)
    _assert_reviewer(req, current_user)
    if req["status"] != "pending":
        raise ConflictError("This request has already been reviewed")

    new_appt = await appointment_service.create_appointment(
        AppointmentCreate(
            patient_id=req["patient_id"],
            doctor_id=req["doctor_id"],
            appointment_date=payload.appointment_date,
            start_time=payload.start_time,
            appointment_type=payload.appointment_type,
            patient_complaint=req.get("patient_complaint"),
            reason=req.get("reason"),
            notes=payload.notes,
            appointment_request_id=request_id,
        ),
        current_user=current_user,
    )

    if req["request_type"] == "reschedule" and req.get("parent_appointment_id"):
        parent_id = req["parent_appointment_id"]
        await admin.table("appointments").update({
            "status": "rescheduled", "rescheduled_to": new_appt["appointment_id"],
        }).eq("appointment_id", parent_id).execute()
        await admin.table("appointments").update({
            "rescheduled_from": parent_id,
        }).eq("appointment_id", new_appt["appointment_id"]).execute()
        new_appt["rescheduled_from"] = parent_id

    res = await admin.table("appointment_requests").update({
        "status": "approved",
        "approved_appointment_id": new_appt["appointment_id"],
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "review_notes": payload.notes,
    }).eq("request_id", request_id).execute()
    req = res.data[0]

    await _record_history(admin, request_id, "request_approved", current_user,
                    old_status="pending", new_status="approved",
                    metadata={"appointment_id": new_appt["appointment_id"]})
    await _notify(admin, req["patient_id"], "appointment_request_approved", "Appointment Confirmed",
            f"Your appointment is confirmed for {new_appt['appointment_date']} at {str(new_appt['start_time'])[:5]}.",
            {"request_id": request_id, "appointment_id": new_appt["appointment_id"]})

    # Reuse names already fetched inside create_appointment → no extra SELECT profiles
    prefetched = {
        new_appt.get("patient_id"): new_appt.get("patient_name"),
        new_appt.get("doctor_id"):  new_appt.get("doctor_name"),
        current_user["id"]:         current_user.get("full_name"),
    }
    out = await _hydrate(admin, req, prefetched_names=prefetched)
    out["approved_appointment"] = new_appt
    await emitter.emit_request_event(
        "appointment_request:approved", {"request": out, "appointment": new_appt},
        clinic_id=req.get("clinic_id"), patient_id=req["patient_id"],
    )
    return out


async def reject_request(request_id: str, payload, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    req = await _load(admin, request_id)
    _assert_reviewer(req, current_user)
    if req["status"] != "pending":
        raise ConflictError("This request has already been reviewed")

    res = await admin.table("appointment_requests").update({
        "status": "rejected",
        "reviewed_by": current_user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "review_notes": payload.review_notes,
    }).eq("request_id", request_id).execute()
    req = res.data[0]

    await _record_history(admin, request_id, "request_rejected", current_user,
                    old_status="pending", new_status="rejected", notes=payload.review_notes)
    await _notify(admin, req["patient_id"], "appointment_request_rejected", "Request Declined",
            f"Your appointment request was declined. Reason: {payload.review_notes}",
            {"request_id": request_id})
    out = await _hydrate(admin, req)
    await emitter.emit_request_event("appointment_request:rejected", {"request": out},
                                     clinic_id=req.get("clinic_id"), patient_id=req["patient_id"])
    return out


# --------------------------------------------------------------------------- #
# Reads
# --------------------------------------------------------------------------- #

async def get_request(request_id: str, *, current_user: dict) -> dict:
    admin = get_supabase_admin()
    req = await _load(admin, request_id)
    role = current_user["role"]
    if role == "patient" and req["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your request")
    if role in ("receptionist", "clinical_assistant", "doctor", "admin"):
        if current_user.get("clinic_id") and req.get("clinic_id") != current_user["clinic_id"]:
            raise ForbiddenError("Request is not in your clinic")
    return await _hydrate(admin, req)


async def list_requests(*, current_user: dict, status: Optional[str] = None,
                  skip: int = 0, limit: int = 20) -> list[dict]:
    admin = get_supabase_admin()
    role = current_user["role"]
    q = admin.table("appointment_requests").select("*")

    if role == "patient":
        q = q.eq("patient_id", current_user["id"])
    elif role == "doctor":
        q = q.eq("doctor_id", current_user["id"])
    else:
        if current_user.get("clinic_id"):
            q = q.eq("clinic_id", current_user["clinic_id"])
        if status is None:
            status = "pending"

    if status:
        q = q.eq("status", status)

    rows = (await q.order("created_at", desc=True).range(skip, skip + limit - 1).execute()).data or []
    names = await _name_map(admin, [r.get("patient_id") for r in rows]
                      + [r.get("doctor_id") for r in rows]
                      + [r.get("reviewed_by") for r in rows])
    for r in rows:
        r["patient_name"] = names.get(r.get("patient_id"))
        r["doctor_name"] = names.get(r.get("doctor_id"))
        r["reviewer_name"] = names.get(r.get("reviewed_by"))
    return rows


async def get_history(request_id: str, *, current_user: dict) -> list[dict]:
    await get_request(request_id, current_user=current_user)
    admin = get_supabase_admin()
    return (await admin.table("appointment_history").select("*").eq(
        "entity_type", "request"
    ).eq("entity_id", request_id).order("changed_at", desc=True).execute()).data or []
