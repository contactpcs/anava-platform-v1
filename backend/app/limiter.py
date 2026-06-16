from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import get_settings

# Redis backend → shared counter across all workers.
# Falls back to in-memory if REDIS_URL is not set (dev / single-worker).
_redis_url = get_settings().REDIS_URL
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=_redis_url if _redis_url else "memory://",
)
