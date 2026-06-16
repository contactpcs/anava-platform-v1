from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user, require_patient
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.limiter import limiter

router = APIRouter()


async def _row(admin, table: str, field: str, value: str) -> dict:
    result = await admin.table(table).select("*").eq(field, value).limit(1).execute()
    return result.data[0] if result.data else {}


@router.get("/dashboard")
@limiter.limit("60/minute")
async def patient_dashboard(request: Request, current_user: dict = Depends(require_patient)):
    admin = get_supabase_admin()
    patient_id = current_user["id"]

    profile = await _row(admin, "profiles", "id", patient_id)
    patient = await _row(admin, "patients", "id", patient_id)

    doctor_info = None
    if patient.get("assigned_doctor_id"):
        dr_id = patient["assigned_doctor_id"]
        dr_profile = await _row(admin, "profiles", "id", dr_id)
        dr_extra  = await _row(admin, "doctors",  "id", dr_id)
        doctor_info = {
            "full_name":            dr_profile.get("full_name"),
            "phone":                dr_profile.get("phone"),
            "specialization":       dr_extra.get("specialization"),
            "hospital_affiliation": dr_extra.get("hospital_affiliation"),
        }

    raw_pending = (await admin.table("assessment_permissions").select(
        "id, disease_id, status, granted_at, prs_diseases(disease_id, disease_name)"
    ).eq("patient_id", patient_id).eq("status", "granted").execute()).data or []
    seen: dict = {}
    for p in raw_pending:
        did = p.get("disease_id")
        if did and did not in seen:
            seen[did] = p
    pending = list(seen.values())

    instances = (await admin.table("prs_assessment_instances").select("instance_id, disease_id").eq(
        "patient_id", patient_id
    ).execute()).data or []
    instance_ids = [i["instance_id"] for i in instances]
    iid_to_disease = {i["instance_id"]: i.get("disease_id") for i in instances}

    recent_scores = []
    if instance_ids:
        raw = (await admin.table("prs_final_results").select(
            "instance_id, calculated_value, max_possible, percentage, "
            "overall_severity, overall_severity_label, time_stamp"
        ).in_("instance_id", instance_ids).order("time_stamp", desc=True).limit(3).execute()).data or []

        d_ids = list({iid_to_disease[r["instance_id"]] for r in raw if iid_to_disease.get(r["instance_id"])})
        dn_map: dict = {}
        if d_ids:
            disease_rows = (await admin.table("prs_diseases").select(
                "disease_id, disease_name"
            ).in_("disease_id", d_ids).execute()).data or []
            dn_map = {d["disease_id"]: d["disease_name"] for d in disease_rows}

        recent_scores = [
            {
                "instance_id":        r.get("instance_id"),
                "disease_id":         iid_to_disease.get(r["instance_id"]),
                "disease_name":       dn_map.get(iid_to_disease.get(r["instance_id"]), iid_to_disease.get(r["instance_id"])),
                "total_score":        r.get("calculated_value"),
                "max_possible_score": r.get("max_possible"),
                "percentage":         r.get("percentage"),
                "severity_level":     r.get("overall_severity"),
                "severity_label":     r.get("overall_severity_label"),
                "recorded_at":        r.get("time_stamp"),
            }
            for r in raw
        ]

    upcoming_instances = (await admin.table("prs_assessment_instances").select("*").eq(
        "patient_id", patient_id
    ).eq("status", "in_progress").order("started_at").limit(2).execute()).data or []

    return success_response({
        "profile": {**profile, **patient},
        "assigned_doctor": doctor_info,
        "pending_assessments": pending,
        "recent_scores": recent_scores,
        "upcoming_instances": upcoming_instances,
    })


@router.get("/my-doctor")
@limiter.limit("60/minute")
async def my_doctor(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    patient = await _row(admin, "patients", "id", current_user["id"])
    if not patient.get("assigned_doctor_id"):
        return success_response(None, "No doctor assigned yet")
    dr_id = patient["assigned_doctor_id"]
    dr_profile = await _row(admin, "profiles", "id", dr_id)
    dr_extra  = await _row(admin, "doctors",  "id", dr_id)
    return success_response({
        "full_name":            dr_profile.get("full_name"),
        "phone":                dr_profile.get("phone"),
        "specialization":       dr_extra.get("specialization"),
        "hospital_affiliation": dr_extra.get("hospital_affiliation"),
    })


@router.get("/my-assessments")
@limiter.limit("60/minute")
async def my_assessments(request: Request, current_user: dict = Depends(get_current_user)):
    """Return disease-level permissions enriched with per-scale completion status."""
    admin = get_supabase_admin()
    patient_id = current_user["id"]

    all_perms = (await admin.table("assessment_permissions").select(
        "id, disease_id, scale_id, status, granted_at, notes, prs_diseases(disease_id, disease_name)"
    ).eq("patient_id", patient_id).order("granted_at", desc=True).execute()).data or []

    if not all_perms:
        return success_response([])

    status_rank = {"completed": 3, "granted": 2, "expired": 1, "revoked": 0}
    seen_diseases: dict = {}
    for p in all_perms:
        did = p.get("disease_id")
        if not did:
            continue
        existing = seen_diseases.get(did)
        if existing is None or status_rank.get(p.get("status"), 0) > status_rank.get(existing.get("status"), 0):
            seen_diseases[did] = p
    perms = list(seen_diseases.values())

    disease_ids = list({p["disease_id"] for p in perms if p.get("disease_id")})

    all_ds_maps = (await admin.table("prs_disease_scale_map").select(
        "disease_id, scale_id, display_order"
    ).in_("disease_id", disease_ids).order("display_order").execute()).data or []

    scale_ids = list({ds["scale_id"] for ds in all_ds_maps})
    scales_name_map: dict = {}
    if scale_ids:
        scales_data = (await admin.table("prs_scales").select(
            "scale_id, scale_code, scale_name"
        ).in_("scale_id", scale_ids).execute()).data or []
        scales_name_map = {s["scale_id"]: s for s in scales_data}

    ds_by_disease: dict = {}
    for ds in all_ds_maps:
        ds_by_disease.setdefault(ds["disease_id"], []).append(ds)

    in_progress = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id"
    ).eq("patient_id", patient_id).eq("status", "in_progress").execute()).data or []
    instance_by_disease = {i["disease_id"]: i["instance_id"] for i in in_progress}

    done_by_instance: dict = {}
    if in_progress:
        iids = [i["instance_id"] for i in in_progress]
        done_scales = (await admin.table("prs_scale_results").select(
            "instance_id, scale_id"
        ).in_("instance_id", iids).execute()).data or []
        for ds in done_scales:
            done_by_instance.setdefault(ds["instance_id"], set()).add(ds["scale_id"])

    result = []
    for perm in perms:
        disease_id = perm.get("disease_id")
        disease_ds = ds_by_disease.get(disease_id, [])
        instance_id = instance_by_disease.get(disease_id)
        done_scale_ids = done_by_instance.get(instance_id, set()) if instance_id else set()

        scales = []
        for ds in disease_ds:
            sid = ds["scale_id"]
            info = scales_name_map.get(sid, {})
            is_scale_done = sid in done_scale_ids
            scales.append({
                "scale_id":   sid,
                "scale_code": info.get("scale_code", sid),
                "scale_name": info.get("scale_name", sid),
                "status":     "completed" if is_scale_done else (
                    "granted" if perm["status"] == "granted" else perm["status"]
                ),
            })

        disease_name = (
            perm.get("prs_diseases", {}).get("disease_name")
            if perm.get("prs_diseases") else None
        ) or disease_id

        result.append({
            "permission_id":     perm["id"],
            "disease_id":        disease_id,
            "disease_name":      disease_name,
            "status":            perm["status"],
            "granted_at":        perm.get("granted_at"),
            "instance_id":       instance_id,
            "scales":            scales,
            "scales_total":      len(scales),
            "scales_completed":  len(done_scale_ids.intersection({ds["scale_id"] for ds in disease_ds})),
        })

    return success_response(result)


@router.get("/my-scores")
@limiter.limit("60/minute")
async def my_scores(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    instances = (await admin.table("prs_assessment_instances").select("instance_id").eq(
        "patient_id", current_user["id"]
    ).execute()).data or []
    instance_ids = [i["instance_id"] for i in instances]
    if not instance_ids:
        return success_response([])
    scores = (await admin.table("prs_final_results").select(
        "final_result_id, instance_id, calculated_value, max_possible, percentage, "
        "overall_severity, overall_severity_label, scale_summaries, time_stamp"
    ).in_("instance_id", instance_ids).order("time_stamp", desc=True).execute()).data or []
    return success_response(scores)
