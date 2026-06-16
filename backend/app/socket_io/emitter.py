"""Helpers to fan out domain events to the right Socket.IO rooms.

All emits are best-effort: a failure in the realtime layer must never break the
DB transaction that triggered it. Domain emits are awaited from async service
methods; `fire(coro)` lets sync code (e.g. notification inserts) schedule an
emit without blocking.
"""
from __future__ import annotations

import asyncio
import structlog

from app.socket_io.server import sio

logger = structlog.get_logger()


def fire(coro) -> None:
    """Schedule a coroutine on the running loop if there is one; else drop it."""
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(coro)
    except RuntimeError:
        # No running loop (e.g. unit tests / sync context) — skip the emit.
        try:
            coro.close()
        except Exception:
            pass


async def _safe_emit(event: str, payload, room: str) -> None:
    try:
        await sio.emit(event, payload, room=room)
    except Exception as e:  # pragma: no cover - realtime must not break flow
        logger.warning("socket_emit_failed", event=event, room=room, error=str(e))


async def emit_appointment_event(event: str, payload, *, clinic_id=None, patient_id=None, doctor_id=None) -> None:
    if patient_id:
        await _safe_emit(event, payload, f"user:{patient_id}")
    if doctor_id:
        await _safe_emit(event, payload, f"doctor:{doctor_id}")
    if clinic_id:
        await _safe_emit(event, payload, f"clinic:{clinic_id}")


async def emit_request_event(event: str, payload, *, clinic_id=None, patient_id=None) -> None:
    if patient_id:
        await _safe_emit(event, payload, f"user:{patient_id}")
    if clinic_id:
        await _safe_emit(event, payload, f"clinic:{clinic_id}")


async def emit_notification(user_id: str, notification: dict) -> None:
    if user_id:
        await _safe_emit("notification:new", {"notification": notification}, f"user:{user_id}")
