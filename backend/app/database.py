from functools import lru_cache
from supabase import AsyncClient
from app.config import get_settings


@lru_cache()
def get_supabase() -> AsyncClient:
    """Anon client — user-context operations (respects RLS)."""
    settings = get_settings()
    return AsyncClient(settings.SUPABASE_URL, settings.SUPABASE_KEY)


@lru_cache()
def get_supabase_admin() -> AsyncClient:
    """Service-role client — bypasses RLS, backend use only.
    Singleton via lru_cache; AsyncClient is stateless for table operations."""
    settings = get_settings()
    return AsyncClient(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
