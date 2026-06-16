"""Redis client manager for Socket.IO multi-node fan-out.

Returns None when REDIS_URL is unset so the server runs with the default
in-process manager (fine for single-worker dev). In production, set REDIS_URL
so emits from any worker reach clients connected to any other worker.
"""
from __future__ import annotations

import structlog

from app.config import get_settings

logger = structlog.get_logger()


def make_client_manager():
    url = get_settings().REDIS_URL
    if not url:
        return None
    try:
        import socketio
        return socketio.AsyncRedisManager(url)
    except Exception as e:  # pragma: no cover - infra dependent
        logger.warning("socketio_redis_manager_init_failed", error=str(e))
        return None
