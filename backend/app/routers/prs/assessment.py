from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid

from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.services.scale_engine import scale_engine
from app.services.scale_config_loader import scale_config_loader
from app.services.disease_engine import disease_engine
from app.utils.responses import success_response
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError
from app.limiter import limiter

router = APIRouter()


class StartAssessmentRequest(BaseModel):
    disease_id: str
    taken_by: str = "patient"
    patient_id: Optional[str] = None  # required when taken_by == doctor_on_behalf
    include_options: bool = False


class ResponseItem(BaseModel):
    question_index: int
    response_value: str
    response_label: Optional[str] = None


class SubmitAssessmentRequest(BaseModel):
    instance_id: str
    scale_id: str
    responses: List[ResponseItem]


class SaveResponseRequest(BaseModel):
    instance_id: str
    scale_id: str
    question_index: int
    question_id: Optional[str] = None
    response_value: str
    response_label: Optional[str] = None


async def _fetch_questions_for_scoring(admin, scale_id: str) -> list:
    """Fetch questions + options (points) for score calculation."""
    questions = (await admin.table("prs_questions").select(
        "question_id, answer_type, display_order"
    ).eq("scale_id", scale_id).order("display_order").execute()).data or []

    if not questions:
        return []

    q_ids = [q["question_id"] for q in questions]
    all_opts = (await admin.table("prs_options").select(
        "question_id, option_value, points"
    ).in_("question_id", q_ids).execute()).data or []

    opts_by_q: dict = {}
    for o in all_opts:
        opts_by_q.setdefault(o["question_id"], []).append({
            "value":  o["option_value"],
            "points": o.get("points", 0),
        })

    for idx, q in enumerate(questions):
        q["options"]        = opts_by_q.get(q["question_id"], [])
        q["question_index"] = idx

    return questions


async def _attach_options_to_questions(admin, questions: list) -> list:
    """Attach `options` to each question via a single batched query."""
    if not questions:
        return questions

    choice_types = {"radio", "likert", "checkbox"}
    numeric_types = {"number", "slider"}

    q_ids = [q["question_id"] for q in questions if q.get("question_id")]
    if not q_ids:
        for q in questions:
            q["options"] = []
        return questions

    opts_result = await admin.table("prs_options").select(
        "question_id, option_id, option_label, option_value, points, display_order"
    ).in_("question_id", q_ids).eq("status", True).order("display_order").execute()

    raw_options = opts_result.data or []
    by_qid: dict = {}
    for o in raw_options:
        by_qid.setdefault(o["question_id"], []).append(o)

    def parse_numeric_constraints(opts: list, question: dict) -> tuple[float, float]:
        min_val = question.get("min_value")
        max_val = question.get("max_value")

        for o in opts:
            label = (o.get("option_label") or "").lower()
            if label.startswith("minimum"):
                try:
                    min_val = float(o.get("option_value"))
                except (TypeError, ValueError):
                    pass
            elif label.startswith("maximum"):
                try:
                    max_candidate = o.get("points") if o.get("points") is not None else o.get("option_value")
                    max_val = float(max_candidate)
                except (TypeError, ValueError):
                    pass

        if min_val is None:
            min_val = 0
        if max_val is None:
            max_val = 100
        return float(min_val), float(max_val)

    for q in questions:
        answer_type = q.get("answer_type") or "radio"
        opts = by_qid.get(q.get("question_id"), [])
        q["options"] = [
            {
                "option_id": o["option_id"],
                "value": o.get("option_value"),
                "label": o.get("option_label"),
                "points": o.get("points", 0),
                "display_order": o.get("display_order", 0),
            }
            for o in opts
        ] if answer_type in choice_types or answer_type in numeric_types else []

        if answer_type in numeric_types:
            min_val, max_val = parse_numeric_constraints(opts, q)
            q["min_value"] = min_val
            q["max_value"] = max_val

    return questions


@router.post("/start")
@limiter.limit("30/minute")
async def start_assessment(
    request: Request,
    body: StartAssessmentRequest,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    role = current_user["role"]

    permission_id = None

    if body.taken_by == "patient" and role == "patient":
        patient_id = current_user["id"]
        perm = (await admin.table("assessment_permissions").select("id, doctor_id").eq(
            "patient_id", patient_id
        ).eq("disease_id", body.disease_id).eq("status", "granted").execute()).data or []
        if not perm:
            raise ForbiddenError("No permission to take this assessment")
        doctor_id = perm[0]["doctor_id"]
        permission_id = perm[0]["id"]

    elif body.taken_by == "doctor_on_behalf" and role in ["doctor", "clinical_assistant", "admin"]:
        if not body.patient_id:
            raise BadRequestError("patient_id is required for doctor_on_behalf")
        patient_id = body.patient_id
        doctor_id = current_user["id"]
        perm = (await admin.table("assessment_permissions").select("id").eq(
            "patient_id", patient_id
        ).eq("disease_id", body.disease_id).eq("status", "granted").execute()).data or []
        if perm:
            permission_id = perm[0]["id"]

    else:
        raise ForbiddenError("Invalid role or taken_by combination")

    patient_clinic_row = (await admin.table("patients").select("clinic_id").eq(
        "id", patient_id
    ).limit(1).execute()).data or []
    patient_clinic_id = patient_clinic_row[0].get("clinic_id") if patient_clinic_row else None

    ana = (await admin.table("anamnesis_assessments").select("status").eq(
        "patient_id", patient_id
    ).eq("status", "completed").limit(1).execute()).data or []
    if not ana:
        raise BadRequestError(
            "Anamnesis Assessment must be completed before starting a PRS assessment"
        )

    existing_query = admin.table("prs_assessment_instances").select(
        "instance_id"
    ).eq("patient_id", patient_id).eq("disease_id", body.disease_id).eq("status", "in_progress")
    if permission_id:
        existing_query = existing_query.eq("permission_id", permission_id)
    existing_instance = (await existing_query.limit(1).execute()).data or []

    if existing_instance:
        instance_id = existing_instance[0]["instance_id"]
        is_resumed = True
    else:
        instance_id = str(uuid.uuid4())
        prior_count = len(
            (await admin.table("prs_assessment_instances").select("instance_id")
            .eq("patient_id", patient_id).execute()).data or []
        )
        instance_label = f"PAT/{patient_id[:8]}/{prior_count + 1:03d}"

        insert_row = {
            "instance_id":    instance_id,
            "instance_label": instance_label,
            "disease_id":     body.disease_id,
            "patient_id":     patient_id,
            "permission_id":  permission_id,
            "initiated_by":   body.taken_by,
            "status":         "in_progress",
        }
        if patient_clinic_id:
            insert_row["clinic_id"] = patient_clinic_id
        await admin.table("prs_assessment_instances").insert(insert_row).execute()
        is_resumed = False

    ds_maps = (await admin.table("prs_disease_scale_map").select(
        "scale_id, display_order"
    ).eq("disease_id", body.disease_id).order("display_order").execute()).data or []
    if not ds_maps:
        raise BadRequestError("No scales configured for this disease")

    scale_ids = [ds["scale_id"] for ds in ds_maps]

    scales_data = (await admin.table("prs_scales").select("*").in_(
        "scale_id", scale_ids
    ).execute()).data or []
    scales_map = {s["scale_id"]: s for s in scales_data}

    all_questions = (await admin.table("prs_questions").select(
        "question_id, scale_id, question_text, answer_type, "
        "min_value, max_value, is_required, skip_logic, display_order"
    ).in_("scale_id", scale_ids).order("display_order").execute()).data or []

    questions_by_scale: dict = {}
    for q in all_questions:
        questions_by_scale.setdefault(q["scale_id"], []).append(q)
    for qs in questions_by_scale.values():
        for idx, q in enumerate(qs):
            q["question_index"] = idx

    all_q_ids = [q["question_id"] for q in all_questions]
    if all_q_ids:
        all_opts = (await admin.table("prs_options").select(
            "option_id, question_id, option_label, option_value, points, display_order"
        ).in_("question_id", all_q_ids).eq("status", True).order("display_order").execute()).data or []
    else:
        all_opts = []

    opts_by_q: dict = {}
    for o in all_opts:
        opts_by_q.setdefault(o["question_id"], []).append(o)

    _CHOICE_TYPES = {"radio", "likert", "checkbox"}
    _NUMERIC_TYPES = {"number", "slider"}

    for q in all_questions:
        qid = q["question_id"]
        answer_type = q.get("answer_type", "radio")
        raw_opts = opts_by_q.get(qid, [])

        if answer_type in _CHOICE_TYPES:
            q["options"] = [
                {
                    "option_id":     o["option_id"],
                    "value":         o["option_value"],
                    "label":         o["option_label"],
                    "points":        o.get("points", 0),
                    "display_order": o.get("display_order", 0),
                }
                for o in raw_opts
            ]
        elif answer_type in _NUMERIC_TYPES:
            min_val = q.get("min_value")
            max_val = q.get("max_value")
            for o in raw_opts:
                lbl = (o.get("option_label") or "").lower()
                if lbl.startswith("minimum"):
                    try: min_val = float(o["option_value"])
                    except (TypeError, ValueError): pass
                elif lbl.startswith("maximum"):
                    try: max_val = float(o["points"] if o.get("points") is not None else o["option_value"])
                    except (TypeError, ValueError): pass
            q["min_value"] = min_val if min_val is not None else 0
            q["max_value"] = max_val if max_val is not None else 100
            q["options"] = []
        else:
            q["options"] = []

    submitted_scale_ids: set = set()
    if is_resumed:
        done = (await admin.table("prs_scale_results").select("scale_id").eq(
            "instance_id", instance_id
        ).execute()).data or []
        submitted_scale_ids = {r["scale_id"] for r in done}

    scales_response = []
    for ds in ds_maps:
        sid = ds["scale_id"]
        scale = scales_map.get(sid, {})
        scales_response.append({
            **scale,
            "questions":    questions_by_scale.get(sid, []),
            "is_completed": sid in submitted_scale_ids,
        })

    disease_row = (await admin.table("prs_diseases").select("disease_name").eq(
        "disease_id", body.disease_id
    ).limit(1).execute()).data or []
    disease_name = disease_row[0]["disease_name"] if disease_row else body.disease_id

    return success_response({
        "instance_id":  instance_id,
        "disease_id":   body.disease_id,
        "disease_name": disease_name,
        "is_resumed":   is_resumed,
        "scales":       scales_response,
    })


@router.post("/submit")
@limiter.limit("30/minute")
async def submit_assessment(
    request: Request,
    body: SubmitAssessmentRequest,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    role = current_user["role"]

    instance_result = await admin.table("prs_assessment_instances").select("*").eq(
        "instance_id", body.instance_id
    ).limit(1).execute()
    if not instance_result.data:
        raise NotFoundError("Assessment instance not found")
    instance = instance_result.data[0]

    if instance["status"] != "in_progress":
        raise BadRequestError("Assessment already submitted")

    user_id = current_user["id"]
    if role == "patient" and instance["patient_id"] != user_id:
        raise ForbiddenError("Not your assessment instance")
    if role not in {"patient", "doctor", "clinical_assistant", "admin"}:
        raise ForbiddenError("Not allowed to submit assessments")

    scale_result = await admin.table("prs_scales").select("*").eq(
        "scale_id", body.scale_id
    ).limit(1).execute()
    if not scale_result.data:
        raise NotFoundError("Scale not found")
    scale = scale_result.data[0]

    questions = await _fetch_questions_for_scoring(admin, body.scale_id)

    scale_code = scale.get("scale_code", body.scale_id)
    scale_config = scale_config_loader.build(scale_code, questions)

    responses_dict = {r.question_index: r.response_value for r in body.responses}
    score_result = scale_engine.calculate_score(scale_config, responses_dict)
    severity     = scale_engine.get_severity(scale_config, score_result.total)
    risk_flags   = scale_engine.detect_risk_flags(scale_config, responses_dict, score_result)

    scale_result_id = f"{body.instance_id}/{body.scale_id}"
    await admin.table("prs_scale_results").upsert({
        "scale_result_id":  scale_result_id,
        "instance_id":      body.instance_id,
        "scale_id":         body.scale_id,
        "calculated_value": score_result.total,
        "max_possible":     score_result.max_possible,
        "severity_level":   severity.level if severity else None,
        "severity_label":   severity.label if severity else None,
        "subscale_scores":  score_result.subscale_scores or {},
        "risk_flags":       [rf.__dict__ for rf in risk_flags],
        "raw_score_data":   score_result.extra or {},
    }, on_conflict="instance_id,scale_id").execute()

    response_rows = []
    for r in body.responses:
        q_id = questions[r.question_index]["question_id"] if r.question_index < len(questions) else None
        if q_id:
            response_id = f"{body.instance_id}/{q_id}"
            response_rows.append({
                "response_id":    response_id,
                "instance_id":    body.instance_id,
                "question_id":    q_id,
                "given_response": r.response_label or r.response_value,
                "response_value": float(r.response_value) if r.response_value.replace(".", "", 1).isdigit() else None,
            })
    if response_rows:
        await admin.table("prs_responses").upsert(
            response_rows, on_conflict="instance_id,question_id"
        ).execute()

    disease_id = instance.get("disease_id")
    all_done = False
    remaining_scale_ids: list = []
    if disease_id:
        expected = (await admin.table("prs_disease_scale_map").select("scale_id").eq(
            "disease_id", disease_id
        ).execute()).data or []
        expected_ids = {s["scale_id"] for s in expected}

        done_rows = (await admin.table("prs_scale_results").select("scale_id").eq(
            "instance_id", body.instance_id
        ).execute()).data or []
        done_ids = {s["scale_id"] for s in done_rows}

        remaining_scale_ids = list(expected_ids - done_ids)
        all_done = len(remaining_scale_ids) == 0

    if all_done:
        await admin.table("prs_assessment_instances").update({
            "status":       "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("instance_id", body.instance_id).execute()

        permission_id = instance.get("permission_id")
        if permission_id:
            await admin.table("assessment_permissions").update({"status": "completed"}).eq(
                "id", permission_id
            ).execute()
        else:
            await admin.table("assessment_permissions").update({"status": "completed"}).eq(
                "patient_id", instance["patient_id"]
            ).eq("disease_id", disease_id).in_("status", ["granted"]).execute()

    disease_result = None
    if disease_id:
        completed = (await admin.table("prs_scale_results").select(
            "scale_id, calculated_value, max_possible"
        ).eq("instance_id", body.instance_id).execute()).data or []

        scale_results_map = {
            r["scale_id"]: {
                "total":        r["calculated_value"],
                "max_possible": r["max_possible"],
            }
            for r in completed
            if r["calculated_value"] is not None
        }

        disease_result = disease_engine.calculate(disease_id, scale_results_map)

    return success_response({
        "scale_result_id":    scale_result_id,
        "calculated_value":   score_result.total,
        "max_possible":       score_result.max_possible,
        "severity_level":     severity.level if severity else None,
        "severity_label":     severity.label if severity else None,
        "subscale_scores":    score_result.subscale_scores or {},
        "component_scores":   score_result.component_scores or {},
        "domain_scores":      score_result.domain_scores or {},
        "extra":              score_result.extra or {},
        "risk_flags":         [rf.__dict__ for rf in risk_flags],
        "all_scales_complete": all_done,
        "remaining_scales":   remaining_scale_ids,
        "disease_score": {
            "score":           disease_result.disease_score if disease_result else None,
            "severity_level":  disease_result.severity_level if disease_result else None,
            "severity_label":  disease_result.severity_label if disease_result else None,
            "scales_used":     disease_result.scales_used if disease_result else None,
            "scales_expected": disease_result.scales_expected if disease_result else None,
        } if disease_result else None,
    }, "Assessment submitted successfully")


# ── Incremental response endpoints ────────────────────────────────────────────

@router.post("/save-response")
@limiter.limit("120/minute")
async def save_response(
    request: Request,
    body: SaveResponseRequest,
    current_user: dict = Depends(get_current_user),
):
    """Save a single question response while the assessment is in progress."""
    admin = get_supabase_admin()

    instance_result = await admin.table("prs_assessment_instances").select(
        "instance_id, patient_id, status"
    ).eq("instance_id", body.instance_id).limit(1).execute()
    if not instance_result.data:
        raise NotFoundError("Assessment instance not found")
    instance = instance_result.data[0]

    if instance["status"] == "completed":
        raise BadRequestError("Assessment already submitted — cannot save more responses")

    role = current_user["role"]
    if role == "patient" and instance["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your assessment instance")

    q_id = body.question_id
    if not q_id:
        questions = (await admin.table("prs_questions").select("question_id").eq(
            "scale_id", body.scale_id
        ).order("display_order").execute()).data or []
        if body.question_index >= len(questions):
            raise BadRequestError(
                f"question_index {body.question_index} out of range "
                f"({len(questions)} questions in this scale)"
            )
        q_id = questions[body.question_index]["question_id"]

    response_id = f"{body.instance_id}/{q_id}"
    val = body.response_value

    await admin.table("prs_responses").upsert({
        "response_id":    response_id,
        "instance_id":    body.instance_id,
        "question_id":    q_id,
        "given_response": body.response_label or val,
        "response_value": float(val) if val.replace(".", "", 1).isdigit() else None,
    }, on_conflict="instance_id,question_id").execute()

    return success_response({
        "response_id":    response_id,
        "instance_id":    body.instance_id,
        "question_id":    q_id,
        "question_index": body.question_index,
        "response_value": val,
        "response_label": body.response_label,
    }, "Response saved")


@router.get("/responses")
@limiter.limit("60/minute")
async def get_instance_responses(
    request: Request,
    instance_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Return all saved responses for an in-progress instance (for resume)."""
    admin = get_supabase_admin()

    instance_result = await admin.table("prs_assessment_instances").select(
        "instance_id, patient_id, disease_id, status, started_at"
    ).eq("instance_id", instance_id).limit(1).execute()
    if not instance_result.data:
        raise NotFoundError("Assessment instance not found")
    instance = instance_result.data[0]

    role = current_user["role"]
    if role == "patient" and instance["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your assessment instance")

    responses = (await admin.table("prs_responses").select(
        "response_id, question_id, given_response, response_value"
    ).eq("instance_id", instance_id).execute()).data or []

    by_question = {
        r["question_id"]: {
            "response_id":    r["response_id"],
            "given_response": r["given_response"],
            "response_value": r["response_value"],
        }
        for r in responses
    }

    return success_response({
        "instance_id":      instance_id,
        "status":           instance["status"],
        "responses_count":  len(responses),
        "responses":        responses,
        "responses_by_qid": by_question,
    })
