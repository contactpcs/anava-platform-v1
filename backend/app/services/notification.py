from app.database import get_supabase_admin
from app.socket_io import emitter


async def send_notification(user_id: str, notif_type: str, title: str, body: str, metadata: dict = None):
    """Persist an in-app notification and push a realtime `notification:new` event."""
    if not user_id:
        return
    admin = get_supabase_admin()
    row = {
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "metadata": metadata or {},
    }
    res = await admin.table("notifications").insert(row).execute()
    saved = res.data[0] if res.data else row
    emitter.fire(emitter.emit_notification(user_id, saved))
    return saved
