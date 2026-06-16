from fastapi import APIRouter, Depends, Query, Request
from app.dependencies import get_current_user, require_staff
from app.database import get_supabase_admin
from app.utils.responses import success_response, paginated_response
from app.utils.exceptions import NotFoundError, ForbiddenError
from app.services.disease_engine import disease_engine
from app.limiter import limiter

router = APIRouter()

_FINAL_COLS = (
    "instance_id, calculated_value, max_possible, percentage, "
    "overall_severity, overall_severity_label, scale_summaries, time_stamp"
)


def _normalize_final(row: dict) -> dict:
    """Map DB trigger column names → consistent frontend keys."""
    row["severity_level"] = row.get("overall_severity")
    row["severity_label"] = row.get("overall_severity_label")
    row["disease_score"]  = row.get("percentage")
    return row


async def _attach_disease_names(admin, instances: list) -> None:
    disease_ids = list({i["disease_id"] for i in instances if i.get("disease_id")})
    if not disease_ids:
        return
    rows = (await admin.table("prs_diseases").select("disease_id, disease_name").in_(
        "disease_id", disease_ids
    ).execute()).data or []
    name_map = {r["disease_id"]: r["disease_name"] for r in rows}
    for inst in instances:
        inst["disease_name"] = name_map.get(inst.get("disease_id"), inst.get("disease_id"))


async def _attach_final_results(admin, instances: list) -> None:
    """Fetch prs_final_results for a batch of instances and merge into each dict."""
    if not instances:
        return
    iids = [i["instance_id"] for i in instances]
    rows = (await admin.table("prs_final_results").select(_FINAL_COLS).in_(
        "instance_id", iids
    ).execute()).data or []
    by_iid = {r["instance_id"]: _normalize_final(r) for r in rows}
    for inst in instances:
        fr = by_iid.get(inst["instance_id"], {})
        inst["disease_score"]    = fr.get("disease_score")
        inst["severity_level"]   = fr.get("severity_level")
        inst["severity_label"]   = fr.get("severity_label")
        inst["calculated_value"] = fr.get("calculated_value")
        inst["max_possible"]     = fr.get("max_possible")
        inst["percentage"]       = fr.get("percentage")
        inst["scale_summaries"]  = fr.get("scale_summaries", [])
        if not inst.get("completed_at"):
            inst["completed_at"] = fr.get("time_stamp")


# ---------------------------------------------------------------------------
# Patient: own scores
# ---------------------------------------------------------------------------

@router.get("/me")
@limiter.limit("60/minute")
async def my_scores(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    instances = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, initiated_by, status, started_at, completed_at"
    ).eq("patient_id", current_user["id"]).eq("status", "completed").order(
        "completed_at", desc=True
    ).range(skip, skip + limit - 1).execute()).data or []

    await _attach_disease_names(admin, instances)
    await _attach_final_results(admin, instances)
    return paginated_response(instances, len(instances), skip, limit)


@router.get("/me/summary")
@limiter.limit("60/minute")
async def my_score_summary(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    instances = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, status, started_at, completed_at"
    ).eq("patient_id", current_user["id"]).eq("status", "completed").order(
        "completed_at", desc=True
    ).execute()).data or []

    await _attach_disease_names(admin, instances)
    await _attach_final_results(admin, instances)

    latest: dict = {}
    for inst in instances:
        did = inst.get("disease_id")
        if did and did not in latest:
            latest[did] = inst

    return success_response({
        "total_assessments":  len(instances),
        "diseases_assessed":  len(latest),
        "latest_by_disease":  list(latest.values()),
    })


# ---------------------------------------------------------------------------
# Instance detail  (patient owner or any staff)
# ---------------------------------------------------------------------------

@router.get("/instance/{instance_id}")
@limiter.limit("60/minute")
async def get_instance_score(
    request: Request,
    instance_id: str,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()

    inst_rows = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, patient_id, initiated_by, status, started_at, completed_at"
    ).eq("instance_id", instance_id).limit(1).execute()).data
    if not inst_rows:
        raise NotFoundError("Assessment instance not found")
    inst = inst_rows[0]

    role = current_user["role"]
    if role == "patient" and inst["patient_id"] != current_user["id"]:
        raise ForbiddenError("Not your assessment")

    disease_name = inst.get("disease_id")
    if inst.get("disease_id"):
        d = (await admin.table("prs_diseases").select("disease_name").eq(
            "disease_id", inst["disease_id"]
        ).limit(1).execute()).data
        if d:
            disease_name = d[0]["disease_name"]
    inst["disease_name"] = disease_name

    fr_rows = (await admin.table("prs_final_results").select(
        _FINAL_COLS + ", all_risk_flags"
    ).eq("instance_id", instance_id).limit(1).execute()).data
    disease_result = None
    if fr_rows:
        disease_result = _normalize_final(fr_rows[0])

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

    weighted_result = None
    if inst.get("disease_id") and scale_results:
        scale_results_map = {
            sr["scale_code"]: {
                "total":        sr["calculated_value"],
                "max_possible": sr["max_possible"],
            }
            for sr in scale_results
            if sr.get("scale_code") and sr.get("calculated_value") is not None
        }
        wr = disease_engine.calculate(inst["disease_id"], scale_results_map)
        if wr:
            weighted_result = {
                "disease_score":    wr.disease_score,
                "severity_level":   wr.severity_level,
                "severity_label":   wr.severity_label,
                "scales_used":      wr.scales_used,
                "scales_expected":  wr.scales_expected,
                "missing_scales":   wr.missing_scales,
                "scale_breakdown":  wr.scale_breakdown,
            }

    return success_response({
        "instance":         inst,
        "disease_result":   disease_result,
        "weighted_result":  weighted_result,
        "scale_results":    scale_results,
    })


# ---------------------------------------------------------------------------
# Staff: patient scores
# ---------------------------------------------------------------------------

@router.get("/patient/{patient_id}/summary")
@limiter.limit("60/minute")
async def patient_score_summary(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_staff),
):
    admin = get_supabase_admin()
    instances = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, status, started_at, completed_at"
    ).eq("patient_id", patient_id).eq("status", "completed").order(
        "completed_at", desc=True
    ).execute()).data or []

    await _attach_disease_names(admin, instances)
    await _attach_final_results(admin, instances)

    latest: dict = {}
    for inst in instances:
        did = inst.get("disease_id")
        if did and did not in latest:
            latest[did] = inst

    return success_response({
        "total_assessments":  len(instances),
        "diseases_assessed":  len(latest),
        "latest_by_disease":  list(latest.values()),
    })


@router.get("/patient/{patient_id}")
@limiter.limit("60/minute")
async def patient_scores(
    request: Request,
    patient_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_staff),
):
    admin = get_supabase_admin()
    instances = (await admin.table("prs_assessment_instances").select(
        "instance_id, disease_id, initiated_by, status, started_at, completed_at"
    ).eq("patient_id", patient_id).eq("status", "completed").order(
        "completed_at", desc=True
    ).range(skip, skip + limit - 1).execute()).data or []

    await _attach_disease_names(admin, instances)
    await _attach_final_results(admin, instances)
    return paginated_response(instances, len(instances), skip, limit)
