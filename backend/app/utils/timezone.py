"""Clinic-local <-> UTC helpers. Clinic timezone from settings.APP_TIMEZONE."""
from datetime import date, time, datetime, timezone
from zoneinfo import ZoneInfo

from app.config import get_settings


def _clinic_tz() -> ZoneInfo:
    return ZoneInfo(get_settings().APP_TIMEZONE)


def local_to_utc(d: date, t: time) -> datetime:
    """Combine a clinic-local date + time into a timezone-aware UTC datetime."""
    local_dt = datetime(d.year, d.month, d.day, t.hour, t.minute, t.second, tzinfo=_clinic_tz())
    return local_dt.astimezone(timezone.utc)


def add_minutes(t: time, minutes: int) -> time:
    """Add minutes to a time-of-day (wraps within a day; used for slot end-times)."""
    base = datetime(2000, 1, 1, t.hour, t.minute, t.second)
    return (base + _td(minutes)).time()


def _td(minutes: int):
    from datetime import timedelta
    return timedelta(minutes=minutes)


def hhmmss(t: time) -> str:
    return t.strftime("%H:%M:%S")


def parse_time(value) -> time:
    """Accept a time, 'HH:MM' or 'HH:MM:SS' string and return a time."""
    if isinstance(value, time):
        return value
    s = str(value)
    parts = s.split(":")
    h = int(parts[0]); m = int(parts[1]) if len(parts) > 1 else 0
    sec = int(parts[2]) if len(parts) > 2 else 0
    return time(h, m, sec)
