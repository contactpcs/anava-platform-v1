import jwt
import httpx
import threading
from cachetools import TTLCache
from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.database import get_supabase_admin
from app.config import get_settings

security = HTTPBearer()

# Refresh JWKS every hour so key rotations are picked up automatically
_jwks_cache: TTLCache = TTLCache(maxsize=1, ttl=3600)
_jwks_lock = threading.Lock()

# Per-user profile cache: removes one Supabase round-trip from every authed request.
# 60s TTL — role/clinic rarely change; invalidations on deactivate handled via _invalidate_profile_cache().
_profile_cache: TTLCache = TTLCache(maxsize=5000, ttl=60)
_profile_lock = threading.Lock()


def _invalidate_profile_cache(user_id: str) -> None:
    with _profile_lock:
        _profile_cache.pop(user_id, None)


def _get_jwks() -> dict:
    """Fetch Supabase JWKS with a 1-hour TTL cache. Thread-safe."""
    with _jwks_lock:
        if "jwks" in _jwks_cache:
            return _jwks_cache["jwks"]
        settings = get_settings()
        try:
            resp = httpx.get(
                f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json",
                headers={"apikey": settings.SUPABASE_KEY},
                timeout=5,
            )
            if resp.status_code == 200:
                _jwks_cache["jwks"] = resp.json()
                return _jwks_cache["jwks"]
        except Exception:
            pass
        return {}


def _decode_token(token: str) -> dict:
    """
    Decode and verify a Supabase JWT.
    Supabase projects may use HS256 (JWT_SECRET) or ES256 (JWKS).
    Try ES256 via JWKS first, fall back to HS256.
    """
    settings = get_settings()

    # Try ES256 via JWKS
    jwks = _get_jwks()
    if jwks.get("keys"):
        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            # Find matching key
            key_data = None
            for k in jwks["keys"]:
                if kid and k.get("kid") == kid:
                    key_data = k
                    break
            if not key_data and jwks["keys"]:
                key_data = jwks["keys"][0]  # fallback to first key

            if key_data:
                from jwt.algorithms import ECAlgorithm, RSAAlgorithm
                alg = header.get("alg", "ES256")
                if alg in ("ES256", "ES384", "ES512"):
                    public_key = ECAlgorithm.from_jwk(key_data)
                else:
                    public_key = RSAAlgorithm.from_jwk(key_data)

                return jwt.decode(
                    token,
                    public_key,
                    algorithms=[alg],
                    options={"verify_aud": False},
                )
        except Exception:
            pass  # Fall through to HS256

    # Fall back to HS256 with JWT_SECRET
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=["HS256"],
        options={"verify_aud": False},
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Validate JWT locally (no network call to Supabase per request).
    Supports both HS256 (legacy) and ES256 (current Supabase default).
    """
    token = credentials.credentials

    try:
        payload = _decode_token(token)
        user_id = payload.get("sub")
        email = payload.get("email", "")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Profile cache check (60s TTL) — saves a Supabase round-trip on most requests.
    with _profile_lock:
        cached = _profile_cache.get(user_id)
    if cached:
        # Re-stamp email from the (fresh) token in case the cached profile email is empty.
        return {**cached, "email": cached.get("email") or email}

    # Look up profile row (no .single() — avoid 500 on missing row)
    admin = get_supabase_admin()
    try:
        result = await admin.table("profiles").select(
            "id, role, full_name, email, is_active, clinic_id"
        ).eq("id", user_id).limit(1).execute()
    except Exception:
        return {"id": user_id, "email": email, "role": None, "full_name": None}

    if not result.data:
        return {"id": user_id, "email": email, "role": None, "full_name": None}

    profile = result.data[0]
    if not profile.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is deactivated. Please contact your clinic receptionist.")

    user = {
        "id": user_id,
        "email": profile.get("email") or email,
        "role": profile["role"],
        "full_name": profile["full_name"],
        "clinic_id": profile.get("clinic_id"),
    }
    with _profile_lock:
        _profile_cache[user_id] = user
    return user


def require_role(allowed_roles: list):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if not current_user.get("role") or current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required roles: {allowed_roles}",
            )
        return current_user
    return role_checker


require_doctor = require_role(["doctor", "admin"])
require_patient = require_role(["patient"])
require_admin = require_role(["admin"])
require_clinical_assistant = require_role(["clinical_assistant", "admin"])
require_receptionist = require_role(["receptionist", "admin"])
require_staff = require_role(["doctor", "clinical_assistant", "receptionist", "admin"])
# Schedule/slot endpoints: every role except patient. Patient never sees the doctor schedule.
require_staff_or_doctor = require_role(["doctor", "clinical_assistant", "receptionist", "admin"])


def require_service_key(x_service_key: str = Header(..., alias="X-Service-Key")) -> None:
    settings = get_settings()
    if not settings.SERVICE_API_KEY or x_service_key != settings.SERVICE_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid service key")
