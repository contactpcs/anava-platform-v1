"""Socket.IO ASGI server, mounted alongside the FastAPI app.

`mount_socketio(app)` returns the combined ASGI application that serves both
the REST API (FastAPI) and the Socket.IO endpoint at /socket.io.
"""
from __future__ import annotations

import socketio

from app.config import get_settings
from app.socket_io.adapter import make_client_manager


def _cors_origins() -> list[str] | str:
    settings = get_settings()
    if settings.SOCKETIO_CORS_ORIGINS:
        return [o.strip() for o in settings.SOCKETIO_CORS_ORIGINS.split(",") if o.strip()]
    return settings.ALLOWED_ORIGINS or "*"


sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=_cors_origins(),
    client_manager=make_client_manager(),
    logger=False,
    engineio_logger=False,
)


def mount_socketio(app):
    """Wrap the FastAPI app so Socket.IO and REST share one ASGI app."""
    return socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="socket.io")
