from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import get_current_user, require_staff, require_patient
from app.models.appointment import (
    AppointmentCreate, AppointmentReschedule, AppointmentCancel, AppointmentUpdate,
)
from app.models.appointment_request import RescheduleRequestCreate
from app.services import appointment_service, request_service
from app.utils.responses import success_response, paginated_response
from app.limiter import limiter

router = APIRouter()


@router.post("")
@limiter.limit("10/minute")
async def create_appointment(request: Request, body: AppointmentCreate,
                             current_user: dict = Depends(require_staff)):
    appt = await appointment_service.create_appointment(body, current_user=current_user)
    return success_response(appt, "Appointment created", status_code=201)


@router.get("")
@limiter.limit("120/minute")
async def list_appointments(
    request: Request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    doctor_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    rows = await appointment_service.list_appointments(
        current_user=current_user, date_from=date_from, date_to=date_to,
        status=status, doctor_id=doctor_id, patient_id=patient_id, skip=skip, limit=limit,
    )
    return paginated_response(rows, len(rows), skip, limit)


@router.get("/upcoming")
@limiter.limit("120/minute")
async def upcoming(request: Request, current_user: dict = Depends(get_current_user)):
    today = date.today()
    rows = await appointment_service.list_appointments(
        current_user=current_user, date_from=today, date_to=today + timedelta(days=14),
        skip=0, limit=100,
    )
    rows = [r for r in rows if r.get("status") in ("scheduled", "confirmed", "checked_in", "in_progress")]
    return success_response(rows)


@router.get("/today")
@limiter.limit("120/minute")
async def today(request: Request, current_user: dict = Depends(require_staff)):
    d = date.today()
    rows = await appointment_service.list_appointments(
        current_user=current_user, date_from=d, date_to=d, skip=0, limit=100,
    )
    return success_response(rows)


@router.get("/{appointment_id}")
@limiter.limit("120/minute")
async def get_appointment(request: Request, appointment_id: str,
                          current_user: dict = Depends(get_current_user)):
    return success_response(await appointment_service.get_appointment(appointment_id, current_user=current_user))


@router.get("/{appointment_id}/history")
@limiter.limit("120/minute")
async def get_history(request: Request, appointment_id: str,
                      current_user: dict = Depends(get_current_user)):
    return success_response(await appointment_service.get_history(appointment_id, current_user=current_user))


@router.patch("/{appointment_id}")
@limiter.limit("30/minute")
async def update_appointment(request: Request, appointment_id: str, body: AppointmentUpdate,
                             current_user: dict = Depends(require_staff)):
    return success_response(
        await appointment_service.update_appointment(appointment_id, body, current_user=current_user),
        "Appointment updated",
    )


@router.post("/{appointment_id}/confirm")
@limiter.limit("30/minute")
async def confirm(request: Request, appointment_id: str, current_user: dict = Depends(require_staff)):
    return success_response(await appointment_service.confirm_appointment(appointment_id, current_user=current_user), "Confirmed")


@router.post("/{appointment_id}/check-in")
@limiter.limit("30/minute")
async def check_in(request: Request, appointment_id: str, current_user: dict = Depends(require_staff)):
    return success_response(await appointment_service.check_in_appointment(appointment_id, current_user=current_user), "Checked in")


@router.post("/{appointment_id}/start")
@limiter.limit("30/minute")
async def start(request: Request, appointment_id: str, current_user: dict = Depends(require_staff)):
    return success_response(await appointment_service.start_appointment(appointment_id, current_user=current_user), "Started")


@router.post("/{appointment_id}/complete")
@limiter.limit("30/minute")
async def complete(request: Request, appointment_id: str, current_user: dict = Depends(require_staff)):
    return success_response(await appointment_service.complete_appointment(appointment_id, current_user=current_user), "Completed")


@router.post("/{appointment_id}/cancel")
@limiter.limit("10/minute")
async def cancel(request: Request, appointment_id: str, body: AppointmentCancel,
                 current_user: dict = Depends(get_current_user)):
    return success_response(
        await appointment_service.cancel_appointment(appointment_id, body, current_user=current_user),
        "Appointment cancelled",
    )


@router.post("/{appointment_id}/reschedule")
@limiter.limit("10/minute")
async def reschedule(request: Request, appointment_id: str, body: AppointmentReschedule,
                     current_user: dict = Depends(require_staff)):
    return success_response(
        await appointment_service.reschedule_appointment_direct(appointment_id, body, current_user=current_user),
        "Appointment rescheduled",
    )


@router.post("/{appointment_id}/request-reschedule")
@limiter.limit("5/minute")
async def request_reschedule(request: Request, appointment_id: str, body: RescheduleRequestCreate,
                            current_user: dict = Depends(require_patient)):
    return success_response(
        await request_service.create_reschedule_request(appointment_id, body, current_user=current_user),
        "Reschedule request submitted", status_code=201,
    )


@router.post("/{appointment_id}/no-show")
@limiter.limit("30/minute")
async def no_show(request: Request, appointment_id: str, current_user: dict = Depends(require_staff)):
    return success_response(await appointment_service.mark_no_show(appointment_id, current_user=current_user), "Marked no-show")
