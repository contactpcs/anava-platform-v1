from fastapi import APIRouter, Depends, Query, Request
from typing import Optional
from pydantic import BaseModel
from app.dependencies import require_doctor, require_staff
from app.database import get_supabase_admin
from app.utils.responses import success_response, paginated_response
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError
from app.routers.prs.permissions import _get_or_create_session
from app.limiter import limiter

router = APIRouter()


async def _row(admin, table: str, field: str, value: str) -> dict:
    result = await admin.table(table).select("*").eq(field, value).limit(1).execute()
    return result.data[0] if result.data else {}


@router.get("/dashboard")
@limiter.limit("60/minute")
async def doctor_dashboard(request: Request, current_user: dict = Depends(require_doctor)):
    admin = get_supabase_admin()
    doctor_id = current_user["id"]

    profile = await _row(admin, "profiles", "id", doctor_id)
    doctor  = await _row(admin, "doctors",  "id", doctor_id)

    clinic_id = current_user.get("clinic_id")
    pq = admin.table("patients").select("id").eq("assigned_doctor_id", doctor_id)
    if clinic_id:
        pq = pq.eq("clinic_id", clinic_id)
    patients = (await pq.execute()).data or []
    patient_ids = [p["id"] for p in patients]

    pending = 0
    if patient_ids:
        perm_res = await admin.table("assessment_permissions").select("id").in_(
            "patient_id", patient_ids
        ).eq("status", "granted").execute()
        pending = len(perm_res.data or [])

    recent = []
    if patient_ids:
        instances = (await admin.table("prs_assessment_instances").select("instance_id").in_(
            "patient_id", patient_ids
        ).eq("status", "completed").order("completed_at", desc=True).limit(5).execute()).data or []
        instance_ids = [i["instance_id"] for i in instances]
        if instance_ids:
            recent = (await admin.table("prs_final_results").select(
                "calculated_value, max_possible, overall_severity_label, time_stamp"
            ).in_("instance_id", instance_ids).order("time_stamp", desc=True).limit(5).execute()).data or []

    return success_response({
        "profile": {**profile, **doctor},
        "patients_summary": {
            "total": len(patients),
            "pending_assessments": pending,
        },
        "recent_completed_assessments": recent,
    })


@router.get("/patients")
@limiter.limit("60/minute")
async def list_patients(
    request: Request,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=200),
    current_user: dict = Depends(require_doctor),
):
    admin = get_supabase_admin()
    clinic_id = current_user.get("clinic_id")
    q = admin.table("patients").select(
        "id, assigned_doctor_id, clinic_id, created_at, "
        "profiles(id, full_name, email, avatar_url, role, created_at)"
    ).eq("approval_status", "approved").is_("deleted_by", "null")
    if clinic_id:
        q = q.eq("clinic_id", clinic_id)
    result = await q.range(skip, skip + limit - 1).execute()
    data = result.data or []

    if search:
        s = search.lower()
        data = [p for p in data if s in (p.get("profiles") or {}).get("full_name", "").lower()]

    patient_ids = [p["id"] for p in data if p.get("id")]
    last_prs_map: dict = {}
    if patient_ids:
        instances = (await admin.table("prs_assessment_instances").select(
            "patient_id, disease_id, completed_at, prs_diseases(disease_name)"
        ).in_("patient_id", patient_ids).eq("status", "completed").order(
            "completed_at", desc=True
        ).execute()).data or []
        for inst in instances:
            pid = inst.get("patient_id")
            if pid and pid not in last_prs_map:
                disease_info = inst.get("prs_diseases") or {}
                last_prs_map[pid] = {
                    "disease_id":   inst.get("disease_id"),
                    "disease_name": disease_info.get("disease_name") or inst.get("disease_id"),
                    "completed_at": inst.get("completed_at"),
                }

    for p in data:
        p["last_prs"] = last_prs_map.get(p.get("id"))

    return paginated_response(data, len(data), skip, limit)


@router.get("/patients/{patient_id}")
@limiter.limit("60/minute")
async def get_patient_detail(request: Request, patient_id: str, current_user: dict = Depends(require_doctor)):
    admin = get_supabase_admin()

    patient = await _row(admin, "patients", "id", patient_id)
    if not patient or patient.get("deleted_by"):
        raise NotFoundError("Patient not found")

    profile     = await _row(admin, "profiles", "id", patient_id)
    permissions = (await admin.table("assessment_permissions").select(
        "*, prs_diseases(disease_id, disease_name)"
    ).eq("patient_id", patient_id).order("granted_at", desc=True).execute()).data or []

    instances = (await admin.table("prs_assessment_instances").select("instance_id").eq(
        "patient_id", patient_id
    ).execute()).data or []
    instance_ids = [i["instance_id"] for i in instances]

    scores_summary = []
    if instance_ids:
        scores_summary = (await admin.table("prs_final_results").select(
            "calculated_value, max_possible, overall_severity, overall_severity_label, time_stamp"
        ).in_("instance_id", instance_ids).order("time_stamp", desc=True).limit(10).execute()).data or []

    recent_instances = (await admin.table("prs_assessment_instances").select("*").eq(
        "patient_id", patient_id
    ).order("started_at", desc=True).limit(5).execute()).data or []

    return success_response({
        "patient": {**patient, **profile},
        "permissions": permissions,
        "scores_summary": scores_summary,
        "recent_instances": recent_instances,
    })


class GrantAssessmentRequest(BaseModel):
    disease_id: str
    notes: Optional[str] = None


@router.post("/patients/{patient_id}/grant-assessment")
@limiter.limit("20/minute")
async def grant_assessment(
    request: Request,
    patient_id: str,
    body: GrantAssessmentRequest,
    current_user: dict = Depends(require_staff),
):
    if current_user["role"] == "receptionist":
        raise ForbiddenError("Receptionists cannot grant assessments")

    admin = get_supabase_admin()

    patient = await _row(admin, "patients", "id", patient_id)
    if not patient:
        raise NotFoundError("Patient not found")

    role = current_user["role"]
    if role in ("doctor", "admin"):
        doctor_id = current_user["id"]
    else:
        doctor_id = patient.get("assigned_doctor_id") or current_user["id"]

    disease = await _row(admin, "prs_diseases", "disease_id", body.disease_id)
    if not disease:
        raise NotFoundError(f"Disease '{body.disease_id}' not found")

    ds_maps = (await admin.table("prs_disease_scale_map").select(
        "scale_id, display_order"
    ).eq("disease_id", body.disease_id).order("display_order").execute()).data or []
    if not ds_maps:
        raise BadRequestError(f"No scales configured for disease '{body.disease_id}'")

    session_id = await _get_or_create_session(admin, patient_id, doctor_id)

    scale_ids_to_grant = [ds["scale_id"] for ds in ds_maps]
    existing_rows = (await admin.table("assessment_permissions").select(
        "id, scale_id, status, disease_id"
    ).eq("patient_id", patient_id).eq("session_id", session_id).in_(
        "scale_id", scale_ids_to_grant
    ).execute()).data or []
    existing_by_scale = {r["scale_id"]: r for r in existing_rows}

    completed_for_disease = [
        r for r in existing_rows
        if r["status"] == "completed" and r.get("disease_id") == body.disease_id
    ]
    if completed_for_disease and len(completed_for_disease) >= len(ds_maps):
        new_session = await admin.table("sessions").insert({
            "patient_id":   patient_id,
            "doctor_id":    doctor_id,
            "session_type": "in_person",
            "status":       "in_progress",
        }).execute()
        session_id = new_session.data[0]["id"]
        existing_by_scale = {}

    perm_id = None
    for ds in ds_maps:
        scale_id = ds["scale_id"]
        existing = existing_by_scale.get(scale_id)

        if existing and existing["status"] == "completed":
            perm_id = perm_id or existing["id"]
            continue

        if existing:
            updated = await admin.table("assessment_permissions").update({
                "doctor_id":  doctor_id,
                "disease_id": body.disease_id,
                "status":     "granted",
                "notes":      body.notes,
            }).eq("id", existing["id"]).execute()
            if updated.data:
                perm_id = perm_id or updated.data[0]["id"]
        else:
            inserted = await admin.table("assessment_permissions").insert({
                "patient_id": patient_id,
                "doctor_id":  doctor_id,
                "scale_id":   scale_id,
                "disease_id": body.disease_id,
                "session_id": session_id,
                "status":     "granted",
                "notes":      body.notes,
            }).execute()
            if inserted.data:
                perm_id = perm_id or inserted.data[0]["id"]

    await admin.table("notifications").insert({
        "user_id": patient_id,
        "type": "permission_granted",
        "title": "New Assessment Assigned",
        "body": (
            f"{current_user['full_name']} assigned you the "
            f"{disease['disease_name']} assessment ({len(ds_maps)} scales)."
        ),
        "metadata": {
            "disease_id": body.disease_id,
            "session_id": session_id,
            "scales_count": len(ds_maps),
        },
    }).execute()

    return success_response({
        "disease_id": body.disease_id,
        "disease_name": disease["disease_name"],
        "session_id": session_id,
        "permission_id": perm_id,
        "scales_count": len(ds_maps),
        "scales_granted": len(ds_maps),
    }, f"Assessment granted for {disease['disease_name']}")


class AvailabilityUpdate(BaseModel):
    availability: str


@router.get("/patients/{patient_id}/results")
@limiter.limit("60/minute")
async def get_patient_result(
    request: Request,
    patient_id: str,
    instance_id: str = Query(...),
    current_user: dict = Depends(require_staff),
):
    """Get a patient's assessment results (doctor view)."""
    if current_user["role"] == "receptionist":
        raise ForbiddenError("Receptionists cannot view assessment results")

    admin = get_supabase_admin()

    patient = await _row(admin, "patients", "id", patient_id)
    if not patient:
        raise NotFoundError("Patient not found")

    inst_rows = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, patient_id, initiated_by, status, started_at, completed_at"
    ).eq("instance_id", instance_id).eq("patient_id", patient_id).limit(1).execute()).data
    if not inst_rows:
        raise NotFoundError("Assessment instance not found")
    inst = inst_rows[0]

    disease_name = inst.get("disease_id")
    if inst.get("disease_id"):
        d = (await admin.table("prs_diseases").select("disease_name").eq(
            "disease_id", inst["disease_id"]
        ).limit(1).execute()).data
        if d:
            disease_name = d[0]["disease_name"]
    inst["disease_name"] = disease_name

    fr_rows = (await admin.table("prs_final_results").select(
        "instance_id, calculated_value, max_possible, percentage, "
        "overall_severity, overall_severity_label, scale_summaries, time_stamp, all_risk_flags"
    ).eq("instance_id", instance_id).limit(1).execute()).data
    disease_result = None
    if fr_rows:
        row = fr_rows[0]
        disease_result = {
            "disease_score": row.get("percentage"),
            "severity_level": row.get("overall_severity"),
            "severity_label": row.get("overall_severity_label"),
            "percentage": row.get("percentage"),
        }

    scale_results = (await admin.table("prs_scale_results").select(
        "scale_result_id, scale_id, calculated_value, max_possible, "
        "severity_level, severity_label, subscale_scores, risk_flags, raw_score_data"
    ).eq("instance_id", instance_id).execute()).data or []

    if scale_results:
        scale_ids = [sr["scale_id"] for sr in scale_results]
        scales = (await admin.table("prs_scales").select(
            "scale_id, scale_code, scale_name"
        ).in_("scale_id", scale_ids).execute()).data or []
        scale_map = {s["scale_id"]: s for s in scales}
        for sr in scale_results:
            s = scale_map.get(sr["scale_id"], {})
            sr["scale_name"] = s.get("scale_name", sr["scale_id"])
            sr["scale_code"] = s.get("scale_code", sr["scale_id"])

    return success_response({
        "instance": inst,
        "disease_result": disease_result,
        "scale_results": scale_results,
    })


@router.put("/availability")
@limiter.limit("20/minute")
async def update_availability(
    request: Request,
    body: AvailabilityUpdate,
    current_user: dict = Depends(require_doctor),
):
    admin = get_supabase_admin()
    result = await admin.table("doctors").update(
        {"availability": body.availability}
    ).eq("id", current_user["id"]).execute()
    return success_response(result.data[0] if result.data else {}, "Availability updated")
