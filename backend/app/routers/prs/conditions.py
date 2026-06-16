from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.utils.exceptions import NotFoundError
from app.limiter import limiter

router = APIRouter()


@router.get("/")
@limiter.limit("60/minute")
async def list_conditions(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    diseases = (await admin.table("prs_diseases").select("*").eq("status", True).execute()).data or []
    for disease in diseases:
        ds_maps = (await admin.table("prs_disease_scale_map").select("scale_id").eq(
            "disease_id", disease["disease_id"]
        ).order("display_order").execute()).data or []
        disease["scale_ids"] = [ds["scale_id"] for ds in ds_maps]
    return success_response(diseases)


@router.get("/{disease_id}")
@limiter.limit("60/minute")
async def get_condition(request: Request, disease_id: str, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    result = await admin.table("prs_diseases").select("*").eq("disease_id", disease_id).limit(1).execute()
    if not result.data:
        raise NotFoundError("Disease not found")
    disease = result.data[0]

    ds_maps = (await admin.table("prs_disease_scale_map").select(
        "ds_map_id, scale_id, display_order"
    ).eq("disease_id", disease_id).order("display_order").execute()).data or []

    scales = []
    for ds in ds_maps:
        s = (await admin.table("prs_scales").select(
            "scale_id, scale_code, scale_name"
        ).eq("scale_id", ds["scale_id"]).limit(1).execute()).data or []
        if s:
            scales.append({**s[0], "display_order": ds["display_order"]})

    return success_response({**disease, "scales": scales})
