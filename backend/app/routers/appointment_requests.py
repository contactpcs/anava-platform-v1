from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.dependencies import get_current_user, require_patient, require_staff
from app.models.appointment_request import (
    AppointmentRequestCreate, RequestApprove, RequestReject,
)
from app.services import request_service
from app.utils.responses import success_response, paginated_response
from app.limiter import limiter

router = APIRouter()


@router.post("")
@limiter.limit("5/minute")
async def create_request(request: Request, body: AppointmentRequestCreate,
                         current_user: dict = Depends(require_patient)):
    req = await request_service.create_new_request(body, current_user=current_user)
    return success_response(req, "Request submitted", status_code=201)


@router.get("")
@limiter.limit("120/minute")
async def list_requests(
    request: Request,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    rows = await request_service.list_requests(current_user=current_user, status=status, skip=skip, limit=limit)
    return paginated_response(rows, len(rows), skip, limit)


@router.get("/{request_id}")
@limiter.limit("120/minute")
async def get_request(request: Request, request_id: str, current_user: dict = Depends(get_current_user)):
    return success_response(await request_service.get_request(request_id, current_user=current_user))


@router.get("/{request_id}/history")
@limiter.limit("120/minute")
async def get_history(request: Request, request_id: str, current_user: dict = Depends(get_current_user)):
    return success_response(await request_service.get_history(request_id, current_user=current_user))


@router.post("/{request_id}/cancel")
@limiter.limit("10/minute")
async def cancel_request(request: Request, request_id: str, current_user: dict = Depends(get_current_user)):
    return success_response(
        await request_service.cancel_request(request_id, current_user=current_user),
        "Request withdrawn",
    )


@router.post("/{request_id}/approve")
@limiter.limit("30/minute")
async def approve_request(request: Request, request_id: str, body: RequestApprove,
                          current_user: dict = Depends(require_staff)):
    return success_response(
        await request_service.approve_request(request_id, body, current_user=current_user),
        "Request approved",
    )


@router.post("/{request_id}/reject")
@limiter.limit("30/minute")
async def reject_request(request: Request, request_id: str, body: RequestReject,
                         current_user: dict = Depends(require_staff)):
    return success_response(
        await request_service.reject_request(request_id, body, current_user=current_user),
        "Request rejected",
    )
