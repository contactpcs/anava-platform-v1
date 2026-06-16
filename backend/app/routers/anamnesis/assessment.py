from fastapi import APIRouter, Depends, Request
from datetime import datetime, timezone

from app.dependencies import get_current_user, require_role
from app.database import get_supabase_admin
from app.models.anamnesis import (
    AnamnesisStartRequest,
    AnamnesisSaveResponseRequest,
    AnamnesisSubmitRequest,
)
from app.utils.responses import success_response
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError
from app.limiter import limiter

router = APIRouter()

require_patient = require_role(["patient"])
require_staff   = require_role(["doctor", "clinical_assistant", "receptionist", "admin"])


def _resolve_patient_id(body_taken_by: str, body_patient_id, current_user: dict) -> str:
    role = current_user["role"]
    if body_taken_by == "patient" and role == "patient":
        return current_user["id"]
    if body_taken_by == "doctor_on_behalf" and role in ["doctor", "clinical_assistant", "admin"]:
        if not body_patient_id:
            raise BadRequestError("patient_id is required for doctor_on_behalf")
        return body_patient_id
    raise ForbiddenError("Invalid role or taken_by combination")


def _assert_access(role: str, user_id: str, rec: dict) -> None:
    if role == "patient" and rec["patient_id"] != user_id:
        raise ForbiddenError("Access denied")
    if role not in ["patient", "doctor", "clinical_assistant", "receptionist", "admin"]:
        raise ForbiddenError("Access denied")


async def _fetch_with_responses(admin, anamnesis_id: str) -> dict:
    rec = (await admin.table("anamnesis_assessments").select("*").eq(
        "anamnesis_id", anamnesis_id
    ).limit(1).execute()).data or []
    if not rec:
        raise NotFoundError("Anamnesis record not found")
    data = rec[0]
    data["responses"] = (await admin.table("anamnesis_responses").select(
        "response_id, question_id, response_value, response_values, updated_at"
    ).eq("anamnesis_id", anamnesis_id).execute()).data or []
    return data


# ---------------------------------------------------------------------------
# GET /questions  — return all questions + options (ordered)
# ---------------------------------------------------------------------------
@router.get("/questions")
@limiter.limit("60/minute")
async def get_anamnesis_questions(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()

    questions = (await admin.table("anamnesis_questions").select(
        "question_id, section_number, section_title, question_code, question_text, "
        "answer_type, is_required, display_order, depends_on_question_id, "
        "depends_on_value, helper_text"
    ).eq("status", True).order("display_order").execute()).data or []

    if not questions:
        return success_response(data=[], message="No questions found")

    q_ids = [q["question_id"] for q in questions]
    all_options = (await admin.table("anamnesis_options").select(
        "option_id, question_id, option_label, option_value, display_order"
    ).in_("question_id", q_ids).order("display_order").execute()).data or []

    opts_by_q: dict = {}
    for o in all_options:
        opts_by_q.setdefault(o["question_id"], []).append(o)

    for q in questions:
        q["options"] = opts_by_q.get(q["question_id"], [])

    return success_response(data=questions, message="Questions retrieved")


# ---------------------------------------------------------------------------
# POST /start
# ---------------------------------------------------------------------------
@router.post("/start")
@limiter.limit("20/minute")
async def start_anamnesis(
    request: Request,
    body: AnamnesisStartRequest,
    current_user: dict = Depends(get_current_user),
):
    admin      = get_supabase_admin()
    patient_id = _resolve_patient_id(body.taken_by, body.patient_id, current_user)

    existing = (await admin.table("anamnesis_assessments").select(
        "anamnesis_id, status"
    ).eq("patient_id", patient_id).limit(1).execute()).data or []

    if existing:
        rec = existing[0]
        if rec["status"] == "completed":
            raise BadRequestError(
                "Anamnesis already completed and is read-only. "
                "Use GET /me or GET /patient/{id} to view it."
            )
        return success_response(
            data={"anamnesis_id": rec["anamnesis_id"], "status": "in_progress", "resumed": True},
            message="Resumed existing in-progress anamnesis",
        )

    anamnesis_id = f"ANA/{patient_id[:8]}/001"
    await admin.table("anamnesis_assessments").insert({
        "anamnesis_id": anamnesis_id,
        "patient_id":   patient_id,
        "taken_by":     body.taken_by,
        "status":       "in_progress",
    }).execute()

    return success_response(
        data={"anamnesis_id": anamnesis_id, "status": "in_progress", "resumed": False},
        message="Anamnesis started",
        status_code=201,
    )


# ---------------------------------------------------------------------------
# POST /save-response  — upsert a single question answer (in_progress only)
# ---------------------------------------------------------------------------
@router.post("/save-response")
@limiter.limit("120/minute")
async def save_response(
    request: Request,
    body: AnamnesisSaveResponseRequest,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    role  = current_user["role"]

    rec_rows = (await admin.table("anamnesis_assessments").select(
        "anamnesis_id, patient_id, status"
    ).eq("anamnesis_id", body.anamnesis_id).limit(1).execute()).data or []

    if not rec_rows:
        raise NotFoundError("Anamnesis record not found")
    rec = rec_rows[0]

    _assert_access(role, current_user["id"], rec)

    if rec["status"] == "completed":
        raise BadRequestError("Anamnesis is already submitted and is read-only")

    if body.response_value is None and body.response_values is None:
        raise BadRequestError("Provide either response_value or response_values")

    response_id = f"{body.anamnesis_id}|{body.question_id}"

    await admin.table("anamnesis_responses").upsert({
        "response_id":     response_id,
        "anamnesis_id":    body.anamnesis_id,
        "question_id":     body.question_id,
        "response_value":  body.response_value,
        "response_values": body.response_values,
    }, on_conflict="anamnesis_id,question_id").execute()

    return success_response(
        data={"response_id": response_id},
        message="Response saved",
    )


# ---------------------------------------------------------------------------
# POST /submit  — optional final batch save + lock
# ---------------------------------------------------------------------------
@router.post("/submit")
@limiter.limit("10/minute")
async def submit_anamnesis(
    request: Request,
    body: AnamnesisSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    role  = current_user["role"]

    rec_rows = (await admin.table("anamnesis_assessments").select(
        "anamnesis_id, patient_id, status"
    ).eq("anamnesis_id", body.anamnesis_id).limit(1).execute()).data or []

    if not rec_rows:
        raise NotFoundError("Anamnesis record not found")
    rec = rec_rows[0]

    _assert_access(role, current_user["id"], rec)

    if rec["status"] == "completed":
        raise BadRequestError("Anamnesis is already submitted and is read-only")

    if body.responses:
        upsert_rows = []
        for r in body.responses:
            if r.response_value is None and r.response_values is None:
                continue
            upsert_rows.append({
                "response_id":     f"{body.anamnesis_id}|{r.question_id}",
                "anamnesis_id":    body.anamnesis_id,
                "question_id":     r.question_id,
                "response_value":  r.response_value,
                "response_values": r.response_values,
            })
        if upsert_rows:
            await admin.table("anamnesis_responses").upsert(
                upsert_rows, on_conflict="anamnesis_id,question_id"
            ).execute()

    await admin.table("anamnesis_assessments").update({
        "status":       "completed",
        "submitted_by": current_user["id"],
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("anamnesis_id", body.anamnesis_id).execute()

    return success_response(
        data={"anamnesis_id": body.anamnesis_id, "status": "completed"},
        message="Anamnesis submitted successfully",
    )


# ---------------------------------------------------------------------------
# GET /me  — patient reads own record + responses
# ---------------------------------------------------------------------------
@router.get("/me")
@limiter.limit("30/minute")
async def get_my_anamnesis(
    request: Request,
    current_user: dict = Depends(require_patient),
):
    admin = get_supabase_admin()

    rec_rows = (await admin.table("anamnesis_assessments").select("anamnesis_id").eq(
        "patient_id", current_user["id"]
    ).limit(1).execute()).data or []

    if not rec_rows:
        raise NotFoundError("No anamnesis found for this patient")

    data = await _fetch_with_responses(admin, rec_rows[0]["anamnesis_id"])
    return success_response(data=data, message="Anamnesis retrieved")


# ---------------------------------------------------------------------------
# GET /patient/{patient_id}  — doctor / admin reads a patient's record
# ---------------------------------------------------------------------------
@router.get("/patient/{patient_id}")
@limiter.limit("30/minute")
async def get_patient_anamnesis(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_staff),
):
    admin = get_supabase_admin()

    rec_rows = (await admin.table("anamnesis_assessments").select("anamnesis_id").eq(
        "patient_id", patient_id
    ).limit(1).execute()).data or []

    if not rec_rows:
        raise NotFoundError("No anamnesis found for this patient")

    data = await _fetch_with_responses(admin, rec_rows[0]["anamnesis_id"])
    return success_response(data=data, message="Anamnesis retrieved")
