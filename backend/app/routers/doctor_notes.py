from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from app.dependencies import require_doctor, require_patient
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.utils.exceptions import ForbiddenError, NotFoundError
from app.limiter import limiter

router = APIRouter()


class NoteUpsert(BaseModel):
    note_text: str


@router.get("/patient/{patient_id}")
@limiter.limit("60/minute")
async def get_note(request: Request, patient_id: str, current_user: dict = Depends(require_doctor)):
    admin = get_supabase_admin()
    rows = (await admin.table("doctor_notes").select("*").eq(
        "patient_id", patient_id
    ).eq("doctor_id", current_user["id"]).limit(1).execute()).data
    return success_response(rows[0] if rows else None)


@router.get("/me")
@limiter.limit("60/minute")
async def get_my_notes(request: Request, current_user: dict = Depends(require_patient)):
    admin = get_supabase_admin()
    rows = (
        await admin.table("doctor_notes")
        .select("*")
        .eq("patient_id", current_user["id"])
        .order("updated_at", desc=True)
        .execute()
    ).data
    return success_response(rows or [])


@router.put("/patient/{patient_id}")
@limiter.limit("30/minute")
async def upsert_note(
    request: Request,
    patient_id: str,
    body: NoteUpsert,
    current_user: dict = Depends(require_doctor),
):
    admin = get_supabase_admin()

    patient = (await admin.table("patients").select("id").eq("id", patient_id).limit(1).execute()).data
    if not patient:
        raise NotFoundError("Patient not found")

    result = await admin.table("doctor_notes").upsert(
        {
            "patient_id": patient_id,
            "doctor_id": current_user["id"],
            "note_text": body.note_text,
            "updated_at": "now()",
        },
        on_conflict="patient_id,doctor_id",
    ).execute()

    return success_response(result.data[0] if result.data else {}, "Note saved")
