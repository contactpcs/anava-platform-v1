from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.dependencies import get_current_user, require_doctor, require_staff
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError
from app.limiter import limiter

router = APIRouter()


class GrantPermissionRequest(BaseModel):
    patient_id: str
    disease_id: str
    notes: Optional[str] = None


async def _get_or_create_session(admin, patient_id: str, doctor_id: str, clinic_id: str = None) -> str:
    """Return an active session_id for this patient-doctor pair, creating one if needed."""
    existing = (await admin.table("sessions").select("id").eq(
        "patient_id", patient_id
    ).eq("doctor_id", doctor_id).in_(
        "status", ["scheduled", "in_progress"]
    ).order("session_date", desc=True).limit(1).execute()).data

    if existing:
        return existing[0]["id"]

    row = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "session_type": "in_person",
        "status": "in_progress",
    }
    if clinic_id:
        row["clinic_id"] = clinic_id
    result = await admin.table("sessions").insert(row).execute()
    return result.data[0]["id"]


@router.post("/")
@limiter.limit("20/minute")
async def grant_permission(
    request: Request,
    body: GrantPermissionRequest,
    current_user: dict = Depends(require_staff),
):
    if current_user["role"] == "receptionist":
        raise ForbiddenError("Receptionists cannot grant assessments")

    admin = get_supabase_admin()

    patient_result = await admin.table("patients").select("assigned_doctor_id, clinic_id").eq(
        "id", body.patient_id
    ).limit(1).execute()
    if not patient_result.data:
        raise NotFoundError("Patient not found")

    patient_clinic_id = patient_result.data[0].get("clinic_id")
    role = current_user["role"]
    if role in ("doctor", "admin"):
        doctor_id = current_user["id"]
    else:
        doctor_id = patient_result.data[0].get("assigned_doctor_id") or current_user["id"]

    disease_result = await admin.table("prs_diseases").select("disease_id, disease_name").eq(
        "disease_id", body.disease_id
    ).limit(1).execute()
    if not disease_result.data:
        raise NotFoundError(f"Disease '{body.disease_id}' not found")
    disease = disease_result.data[0]

    ds_maps = (await admin.table("prs_disease_scale_map").select(
        "scale_id"
    ).eq("disease_id", body.disease_id).execute()).data or []
    if not ds_maps:
        raise BadRequestError(f"No scales configured for disease '{body.disease_id}'")

    session_id = await _get_or_create_session(admin, body.patient_id, doctor_id, clinic_id=patient_clinic_id)

    perm_rows = [
        {
            "patient_id": body.patient_id,
            "doctor_id":  doctor_id,
            "scale_id":   ds["scale_id"],
            "disease_id": body.disease_id,
            "session_id": session_id,
            "status":     "granted",
            "notes":      body.notes,
            **({"clinic_id": patient_clinic_id} if patient_clinic_id else {}),
        }
        for ds in ds_maps
    ]
    result = await admin.table("assessment_permissions").upsert(
        perm_rows, on_conflict="patient_id,scale_id,session_id"
    ).execute()
    perm_id = result.data[0]["id"] if result.data else None

    await admin.table("notifications").insert({
        "user_id": body.patient_id,
        "type": "permission_granted",
        "title": "New Assessment Available",
        "body": (
            f"{current_user['full_name']} has assigned you the "
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


@router.get("/patient/{patient_id}")
@limiter.limit("60/minute")
async def get_patient_permissions(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_staff),
):
    admin = get_supabase_admin()
    perms = (await admin.table("assessment_permissions").select(
        "id, patient_id, doctor_id, disease_id, scale_id, status, granted_at, expires_at, "
        "prs_diseases(disease_id, disease_name)"
    ).eq("patient_id", patient_id).order("granted_at", desc=True).execute()).data or []

    status_rank = {"completed": 3, "granted": 2, "expired": 1, "revoked": 0}
    disease_map: dict = {}
    for p in perms:
        did = p.get("disease_id")
        if not did:
            continue
        existing = disease_map.get(did)
        if existing is None or status_rank.get(p["status"], 0) > status_rank.get(existing["status"], 0):
            disease_map[did] = p

    deduplicated = list(disease_map.values())

    completed_disease_ids = [
        d["disease_id"] for d in deduplicated if d.get("status") == "completed"
    ]
    instance_by_disease: dict = {}
    if completed_disease_ids:
        instances = (await admin.table("prs_assessment_instances").select(
            "instance_id, disease_id, completed_at"
        ).eq("patient_id", patient_id).eq("status", "completed").in_(
            "disease_id", completed_disease_ids
        ).order("completed_at", desc=True).execute()).data or []
        for inst in instances:
            did = inst["disease_id"]
            if did not in instance_by_disease:
                instance_by_disease[did] = inst["instance_id"]

    result = []
    for p in deduplicated:
        disease_info = p.get("prs_diseases") or {}
        did = p.get("disease_id")
        result.append({
            "permission_id": p["id"],
            "patient_id":    p["patient_id"],
            "granted_by":    p.get("doctor_id"),
            "disease_id":    did,
            "disease_name":  disease_info.get("disease_name") or did,
            "status":        p.get("status"),
            "granted_at":    p.get("granted_at"),
            "expires_at":    p.get("expires_at"),
            "instance_id":   instance_by_disease.get(did),
        })

    return success_response(result)


@router.get("/my")
@limiter.limit("60/minute")
async def get_my_permissions(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    perms = (await admin.table("assessment_permissions").select(
        "*, prs_diseases(disease_id, disease_name)"
    ).eq("patient_id", current_user["id"]).eq("status", "granted").execute()).data or []
    return success_response(perms)


@router.put("/{permission_id}/revoke")
@limiter.limit("20/minute")
async def revoke_permission(
    request: Request,
    permission_id: str,
    current_user: dict = Depends(require_doctor),
):
    admin = get_supabase_admin()
    result = await admin.table("assessment_permissions").update({
        "status": "revoked",
        "revoked_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", permission_id).eq("doctor_id", current_user["id"]).execute()
    return success_response(result.data[0] if result.data else {}, "Permission revoked")
