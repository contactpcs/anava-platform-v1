"""JWT verification for the Socket.IO handshake.

Reuses the REST token decoder so socket auth and HTTP auth stay identical.
The client connects with: io(url, { auth: { token: <access_token> } }).
"""
from __future__ import annotations

from typing import Optional

from app.dependencies import _decode_token
from app.database import get_supabase_admin


async def authenticate(auth: Optional[dict], environ: dict) -> Optional[dict]:
    """Return a user dict {id, role, clinic_id} or None if the token is invalid."""
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        # Fallback: Authorization header on the handshake
        header = environ.get("HTTP_AUTHORIZATION", "")
        if header.lower().startswith("bearer "):
            token = header[7:]
    if not token:
        return None

    try:
        payload = _decode_token(token)
    except Exception:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    admin = get_supabase_admin()
    try:
        rows = (await admin.table("profiles").select("id, role, clinic_id, is_active").eq(
            "id", user_id
        ).limit(1).execute()).data or []
    except Exception:
        return None
    if not rows or not rows[0].get("is_active"):
        return None

    return {"id": user_id, "role": rows[0].get("role"), "clinic_id": rows[0].get("clinic_id")}
