from fastapi import APIRouter, Depends, Request
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.utils.responses import success_response
from app.limiter import limiter

router = APIRouter()


@router.get("/")
@limiter.limit("60/minute")
async def get_notifications(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    result = await admin.table("notifications").select("*").eq(
        "user_id", current_user["id"]
    ).order("created_at", desc=True).limit(20).execute()
    return success_response(result.data or [])


@router.put("/read-all")
@limiter.limit("20/minute")
async def mark_all_read(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    await admin.table("notifications").update({"is_read": True}).eq(
        "user_id", current_user["id"]
    ).eq("is_read", False).execute()
    return success_response({}, "All notifications marked as read")


@router.put("/{notification_id}/read")
@limiter.limit("30/minute")
async def mark_read(
    request: Request,
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    admin = get_supabase_admin()
    result = await admin.table("notifications").update({"is_read": True}).eq(
        "id", notification_id
    ).eq("user_id", current_user["id"]).execute()
    return success_response(result.data[0] if result.data else {})
