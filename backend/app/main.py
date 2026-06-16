from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.config import get_settings
from app.limiter import limiter
from app.socket_io.server import mount_socketio
from app.socket_io import events as _socket_events  # noqa: F401 — registers connect/disconnect handlers
from app.scheduler.scheduler import start_scheduler, shutdown_scheduler
from app.routers import auth, doctors, patients, notifications, staff, users, doctor_notes, admin, consent
from app.routers import appointments, appointment_requests, doctor_schedule, eeg_reports
from app.routers.prs import scales, conditions, permissions, assessment, scores, questions
from app.routers.anamnesis import assessment as anamnesis_assessment
from app.database_tsdb import check_tsdb_health

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    try:
        yield
    finally:
        shutdown_scheduler()


app = FastAPI(
    title="NeuroWellness API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# Attach limiter to app state so @limiter.limit() decorators can find it
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS must be added BEFORE SlowAPIMiddleware so it wraps all responses
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    max_age=600,
)
app.add_middleware(SlowAPIMiddleware)

PREFIX = settings.API_PREFIX

app.include_router(auth.router,          prefix=f"{PREFIX}/auth",            tags=["auth"])
app.include_router(users.router,         prefix=f"{PREFIX}/users",           tags=["users"])
app.include_router(doctors.router,       prefix=f"{PREFIX}/doctors",         tags=["doctors"])
app.include_router(patients.router,      prefix=f"{PREFIX}/patients",        tags=["patients"])
app.include_router(notifications.router, prefix=f"{PREFIX}/notifications",   tags=["notifications"])
app.include_router(staff.router,         prefix=f"{PREFIX}/staff",           tags=["staff"])
app.include_router(anamnesis_assessment.router, prefix=f"{PREFIX}/anamnesis",   tags=["anamnesis"])
app.include_router(scales.router,        prefix=f"{PREFIX}/prs/scales",      tags=["prs-scales"])
app.include_router(conditions.router,    prefix=f"{PREFIX}/prs/conditions",  tags=["prs-conditions"])
app.include_router(permissions.router,   prefix=f"{PREFIX}/prs/permissions", tags=["prs-permissions"])
app.include_router(assessment.router,    prefix=f"{PREFIX}/prs/assessment",  tags=["prs-assessment"])
app.include_router(scores.router,        prefix=f"{PREFIX}/prs/scores",      tags=["prs-scores"])
app.include_router(questions.router,     prefix=f"{PREFIX}/prs/questions",   tags=["prs-questions"])
app.include_router(doctor_notes.router,  prefix=f"{PREFIX}/doctor-notes",    tags=["doctor-notes"])
app.include_router(admin.router,         prefix=f"{PREFIX}/admin",            tags=["admin"])
app.include_router(consent.router,       prefix=f"{PREFIX}/consent",          tags=["consent"])
app.include_router(appointments.router,         prefix=f"{PREFIX}/appointments",         tags=["appointments"])
app.include_router(appointment_requests.router, prefix=f"{PREFIX}/appointment-requests", tags=["appointment-requests"])
app.include_router(doctor_schedule.router,      prefix=f"{PREFIX}/schedule",             tags=["schedule"])
app.include_router(eeg_reports.router,               prefix=f"{PREFIX}/eeg/reports",   tags=["eeg-reports"])


@app.get("/health")
async def health():
    tsdb_ok = await check_tsdb_health()
    return {
        "status": "ok",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "services": {"timescaledb": "ok" if tsdb_ok else "degraded"},
    }


# Combined ASGI app: FastAPI (REST) + Socket.IO (realtime) at /socket.io.
# Launch with: uvicorn app.main:asgi_app
asgi_app = mount_socketio(app)
