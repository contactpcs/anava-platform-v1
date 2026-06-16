"""Socket.IO connection lifecycle handlers.

On connect, the user is authenticated and auto-joined to their rooms:
  user:{id}, role:{role}, clinic:{clinic_id}, and doctor:{id} for doctors.
These rooms are the targets used by emitter.py.
"""
from __future__ import annotations

import structlog

from app.socket_io.server import sio
from app.socket_io.auth import authenticate

logger = structlog.get_logger()


def _rooms_for(user: dict) -> list[str]:
    rooms = [f"user:{user['id']}"]
    if user.get("role"):
        rooms.append(f"role:{user['role']}")
    if user.get("clinic_id"):
        rooms.append(f"clinic:{user['clinic_id']}")
    if user.get("role") in ("doctor", "admin"):
        rooms.append(f"doctor:{user['id']}")
    return rooms


@sio.event
async def connect(sid, environ, auth):
    user = await authenticate(auth, environ)
    if not user:
        raise ConnectionRefusedError("authentication failed")
    await sio.save_session(sid, user)
    for room in _rooms_for(user):
        await sio.enter_room(sid, room)
    await sio.emit("connected", {"user_id": user["id"]}, to=sid)
    logger.info("socket_connect", sid=sid, user_id=user["id"], role=user.get("role"))


@sio.event
async def disconnect(sid):
    logger.info("socket_disconnect", sid=sid)
