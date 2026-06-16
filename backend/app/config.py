from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    SUPABASE_URL: str
    SUPABASE_KEY: str          # anon key
    SUPABASE_SERVICE_KEY: str  # service role key (backend only, never expose)
    JWT_SECRET: str            # from Supabase Settings → API → JWT Settings

    # TimescaleDB (EEG reports)
    TSDB_DATABASE_URL: str = "postgres://tsdbadmin:k4220hmly8g8jsed@gguyvxc03b.oiyo0zj1k9.tsdb.cloud.timescale.com:35472/tsdb?sslmode=require"

    # S3 storage (EEG report PDFs)
    S3_BUCKET_NAME: str = "neurowellness-eeg-reports"
    AWS_REGION: str = "ap-south-1"
    # Leave empty on EC2 — IAM instance role provides credentials automatically
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None

    # File storage (legacy local path, unused when S3 enabled)
    UPLOADS_DIR: str = "uploads"

    # App
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Admin bootstrap
    BOOTSTRAP_SECRET_KEY: str = ""

    # Service-to-service auth (brain_mapping → /eeg/reports/register)
    SERVICE_API_KEY: str = ""

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 200

    # Appointments / scheduling
    APP_TIMEZONE: str = "Asia/Kolkata"
    APPOINTMENT_DEFAULT_SLOT_MINUTES: int = 60
    APPOINTMENT_MAX_BOOKING_DAYS_AHEAD: int = 60
    APPOINTMENT_REQUEST_EXPIRY_HOURS: float = 72
    APPOINTMENT_CANCEL_MIN_HOURS: float = 2
    APPOINTMENT_RESCHEDULE_MIN_HOURS: float = 24

    # Real-time + background jobs (Milestone B)
    REDIS_URL: str = ""                       # empty → single-process in-memory Socket.IO manager
    SOCKETIO_CORS_ORIGINS: str = ""           # comma-separated; falls back to ALLOWED_ORIGINS
    RUN_SCHEDULER: bool = True
    APPOINTMENT_REMINDER_24H_ENABLED: bool = True
    APPOINTMENT_REMINDER_1H_ENABLED: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()
