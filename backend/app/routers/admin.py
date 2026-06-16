from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.dependencies import require_admin, _invalidate_profile_cache
from app.database import get_supabase_admin, AsyncClient
from app.config import get_settings
from app.utils.responses import success_response, paginated_response
from app.utils.exceptions import ForbiddenError, NotFoundError, BadRequestError
from app.limiter import limiter

router = APIRouter()

STAFF_ROLES = {"doctor", "receptionist", "clinical_assistant"}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _row(admin, table: str, field: str, value: str) -> Optional[dict]:
    result = await admin.table(table).select("*").eq(field, value).limit(1).execute()
    return result.data[0] if result.data else None


async def _get_admin_clinic_id(admin_db, user_id: str) -> Optional[str]:
    """Return this admin's clinic_id (None if unassigned — global super-admin)."""
    result = await admin_db.table("admins").select("clinic_id").eq("id", user_id).limit(1).execute()
    return result.data[0].get("clinic_id") if result.data else None


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class CreateClinicRequest(BaseModel):
    clinic_name: str
    owner_name: str
    admin_name: str
    admin_email: EmailStr
    admin_password: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"


class UpdateClinicRequest(BaseModel):
    clinic_name: Optional[str] = None
    owner_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None


class CreateClinicAdminRequest(BaseModel):
    clinic_name: str
    owner_name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"


class RegisterStaffRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str
    clinic_id: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: str = "India"
    # Doctor-specific
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    years_of_experience: Optional[int] = None
    # Staff-specific
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None


class UpdateStaffRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_affiliation: Optional[str] = None
    years_of_experience: Optional[int] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    availability: Optional[str] = None


# ---------------------------------------------------------------------------
# Bootstrap — create clinic + first admin (protected by secret key)
# ---------------------------------------------------------------------------

@router.post("/clinics/create")
@limiter.limit("5/minute")
async def create_clinic_with_admin(
    request: Request,
    body: CreateClinicRequest,
    x_bootstrap_key: Optional[str] = Header(None),
):
    """
    Public bootstrap endpoint — creates a clinic and its first admin account.
    Requires X-Bootstrap-Key header matching BOOTSTRAP_SECRET_KEY in settings.
    """
    settings = get_settings()
    if not settings.BOOTSTRAP_SECRET_KEY or x_bootstrap_key != settings.BOOTSTRAP_SECRET_KEY:
        raise ForbiddenError("Invalid or missing bootstrap key")

    admin = get_supabase_admin()

    clinic_res = await admin.table("clinics").insert({
        "clinic_name": body.clinic_name,
        "owner_name": body.owner_name,
        "address": body.address,
        "phone": body.phone,
        "email": body.email,
        "city": body.city,
        "state": body.state,
        "country": body.country,
        "is_active": True,
    }).execute()
    if not clinic_res.data:
        raise HTTPException(status_code=500, detail="Failed to create clinic")
    clinic_id = clinic_res.data[0]["clinic_id"]

    try:
        user_res = await admin.auth.admin.create_user({
            "email": body.admin_email,
            "password": body.admin_password,
            "email_confirm": True,
        })
    except Exception as e:
        await admin.table("clinics").delete().eq("clinic_id", clinic_id).execute()
        msg = str(e).lower()
        if "already registered" in msg or "already been registered" in msg:
            raise HTTPException(status_code=409, detail="Admin email already registered")
        raise HTTPException(status_code=400, detail=f"Could not create admin user: {e}")

    user_id = user_res.user.id

    try:
        await admin.table("profiles").insert({
            "id": user_id,
            "role": "admin",
            "full_name": body.admin_name,
            "email": body.admin_email,
            "clinic_id": clinic_id,
            "is_active": True,
        }).execute()

        await admin.table("admins").insert({
            "id": user_id,
            "clinic_id": clinic_id,
        }).execute()
    except Exception as e:
        try:
            await admin.auth.admin.delete_user(user_id)
            await admin.table("clinics").delete().eq("clinic_id", clinic_id).execute()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Profile creation failed: {e}")

    settings = get_settings()
    try:
        fresh = AsyncClient(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        sign_in = await fresh.auth.sign_in_with_password({
            "email": body.admin_email,
            "password": body.admin_password,
        })
        session = sign_in.session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clinic created but login failed: {e}")

    return success_response({
        "clinic_id": clinic_id,
        "clinic_name": body.clinic_name,
        "admin_id": user_id,
        "access_token": session.access_token,
        "refresh_token": session.refresh_token,
        "expires_in": session.expires_in,
    }, "Clinic and admin created successfully", status_code=201)


# ---------------------------------------------------------------------------
# Admin dashboard — global stats across all clinics
# ---------------------------------------------------------------------------

@router.get("/dashboard")
@limiter.limit("60/minute")
async def admin_dashboard(request: Request, current_user: dict = Depends(require_admin)):
    admin = get_supabase_admin()

    clinics = (await admin.table("clinics").select("clinic_id, clinic_name, city, state, is_active").execute()).data or []
    total_clinics = len(clinics)

    profiles = (await admin.table("profiles").select("role, clinic_id").execute()).data or []
    total_doctors = sum(1 for p in profiles if p["role"] == "doctor")
    total_receptionists = sum(1 for p in profiles if p["role"] == "receptionist")
    total_clinical_assistants = sum(1 for p in profiles if p["role"] == "clinical_assistant")
    total_patients = sum(1 for p in profiles if p["role"] == "patient")

    pending_patients = (await admin.table("patients").select("id").eq("approval_status", "pending").execute()).data or []
    active_assessments = (await admin.table("assessment_permissions").select("id").eq("status", "granted").execute()).data or []

    breakdown = []
    for c in clinics:
        cid = c["clinic_id"]
        staff_count = sum(1 for p in profiles if p.get("clinic_id") == cid and p["role"] in STAFF_ROLES)
        patient_count = sum(1 for p in profiles if p.get("clinic_id") == cid and p["role"] == "patient")
        breakdown.append({
            "clinic_id": cid,
            "clinic_name": c["clinic_name"],
            "city": c.get("city"),
            "state": c.get("state"),
            "is_active": c["is_active"],
            "staff_count": staff_count,
            "patient_count": patient_count,
        })

    return success_response({
        "stats": {
            "total_clinics": total_clinics,
            "total_doctors": total_doctors,
            "total_receptionists": total_receptionists,
            "total_clinical_assistants": total_clinical_assistants,
            "total_patients": total_patients,
            "pending_approvals": len(pending_patients),
            "active_assessments": len(active_assessments),
        },
        "clinic_breakdown": breakdown,
    })


# ---------------------------------------------------------------------------
# Clinic management
# ---------------------------------------------------------------------------

@router.post("/clinics")
@limiter.limit("10/minute")
async def create_clinic(
    request: Request,
    body: CreateClinicAdminRequest,
    current_user: dict = Depends(require_admin),
):
    """Admin creates a new clinic from the dashboard (no bootstrap key needed)."""
    admin = get_supabase_admin()
    result = await admin.table("clinics").insert({
        "clinic_name": body.clinic_name,
        "owner_name": body.owner_name,
        "address": body.address,
        "phone": body.phone,
        "email": body.email,
        "city": body.city,
        "state": body.state,
        "country": body.country,
        "is_active": True,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create clinic")
    return success_response(result.data[0], "Clinic created", status_code=201)


@router.get("/clinics")
@limiter.limit("60/minute")
async def list_clinics(request: Request, current_user: dict = Depends(require_admin)):
    admin = get_supabase_admin()
    clinics = (await admin.table("clinics").select("*").order("created_at", desc=False).execute()).data or []
    return success_response(clinics)


@router.get("/clinics/{clinic_id}")
@limiter.limit("60/minute")
async def get_clinic(request: Request, clinic_id: str, current_user: dict = Depends(require_admin)):
    admin = get_supabase_admin()
    clinic = await _row(admin, "clinics", "clinic_id", clinic_id)
    if not clinic:
        raise NotFoundError("Clinic not found")
    return success_response(clinic)


@router.put("/clinics/{clinic_id}")
@limiter.limit("20/minute")
async def update_clinic(
    request: Request,
    clinic_id: str,
    body: UpdateClinicRequest,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    clinic = await _row(admin, "clinics", "clinic_id", clinic_id)
    if not clinic:
        raise NotFoundError("Clinic not found")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise BadRequestError("No fields to update")

    result = await admin.table("clinics").update(updates).eq("clinic_id", clinic_id).execute()
    return success_response(result.data[0] if result.data else {}, "Clinic updated")


@router.put("/clinics/{clinic_id}/deactivate")
@limiter.limit("10/minute")
async def deactivate_clinic(
    request: Request,
    clinic_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    clinic = await _row(admin, "clinics", "clinic_id", clinic_id)
    if not clinic:
        raise NotFoundError("Clinic not found")
    await admin.table("clinics").update({"is_active": False}).eq("clinic_id", clinic_id).execute()
    return success_response({"clinic_id": clinic_id}, "Clinic deactivated")


@router.put("/clinics/{clinic_id}/activate")
@limiter.limit("10/minute")
async def activate_clinic(
    request: Request,
    clinic_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    clinic = await _row(admin, "clinics", "clinic_id", clinic_id)
    if not clinic:
        raise NotFoundError("Clinic not found")
    await admin.table("clinics").update({"is_active": True}).eq("clinic_id", clinic_id).execute()
    return success_response({"clinic_id": clinic_id}, "Clinic activated")


# ---------------------------------------------------------------------------
# Staff management — global (all clinics)
# ---------------------------------------------------------------------------

@router.get("/staff")
@limiter.limit("60/minute")
async def list_staff(
    request: Request,
    clinic_id: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()

    q = admin.table("profiles").select(
        "id, full_name, email, role, clinic_id, is_active, city, state, created_at"
    ).in_("role", list(STAFF_ROLES))

    if clinic_id:
        q = q.eq("clinic_id", clinic_id)
    if role and role in STAFF_ROLES:
        q = q.eq("role", role)
    if is_active is not None:
        q = q.eq("is_active", is_active)

    result = await q.order("created_at", desc=True).range(skip, skip + limit - 1).execute()
    data = result.data or []

    role_ids: dict = {"doctor": [], "receptionist": [], "clinical_assistant": []}
    for p in data:
        if p["role"] in role_ids:
            role_ids[p["role"]].append(p["id"])

    role_map: dict = {}
    role_tables = {"doctor": "doctors", "receptionist": "receptionists", "clinical_assistant": "clinical_assistants"}
    for role_name, ids in role_ids.items():
        if ids:
            rows = (await admin.table(role_tables[role_name]).select("*").in_("id", ids).execute()).data or []
            for r in rows:
                role_map[r["id"]] = r

    clinics = {c["clinic_id"]: c["clinic_name"] for c in
               ((await admin.table("clinics").select("clinic_id, clinic_name").execute()).data or [])}

    enriched = []
    for p in data:
        extra = role_map.get(p["id"], {})
        if extra.get("deleted_by"):
            continue
        enriched.append({
            **p,
            **extra,
            "clinic_name": clinics.get(p.get("clinic_id"), "—"),
        })

    total = len(enriched)
    return paginated_response(enriched, total, skip, limit)


@router.get("/staff/{staff_id}")
@limiter.limit("60/minute")
async def get_staff_member(
    request: Request,
    staff_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    profile = await _row(admin, "profiles", "id", staff_id)
    if not profile or profile.get("role") not in STAFF_ROLES:
        raise NotFoundError("Staff member not found")

    table = {"doctor": "doctors", "receptionist": "receptionists",
             "clinical_assistant": "clinical_assistants"}.get(profile["role"])
    extra = await _row(admin, table, "id", staff_id) if table else {}

    clinic = None
    if profile.get("clinic_id"):
        clinic = await _row(admin, "clinics", "clinic_id", profile["clinic_id"])

    return success_response({**profile, **(extra or {}), "clinic": clinic})


@router.post("/staff/register")
@limiter.limit("10/minute")
async def register_staff(
    request: Request,
    body: RegisterStaffRequest,
    current_user: dict = Depends(require_admin),
):
    if body.role not in STAFF_ROLES:
        raise BadRequestError(f"Role must be one of: {sorted(STAFF_ROLES)}")

    admin = get_supabase_admin()

    target_clinic_id = body.clinic_id or await _get_admin_clinic_id(admin, current_user["id"])
    if not target_clinic_id:
        raise BadRequestError("clinic_id is required — provide it in the request body or ensure your admin account is assigned to a clinic")

    clinic = await _row(admin, "clinics", "clinic_id", target_clinic_id)
    if not clinic:
        raise NotFoundError("Target clinic not found")

    try:
        user_res = await admin.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
        })
    except Exception as e:
        msg = str(e).lower()
        if "already registered" in msg or "already been registered" in msg:
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=f"Could not create user: {e}")

    user_id = user_res.user.id

    try:
        await admin.rpc("register_staff_db", {
            "p_id": user_id,
            "p_role": body.role,
            "p_full_name": body.full_name,
            "p_email": body.email,
            "p_phone": body.phone,
            "p_city": body.city,
            "p_state": body.state,
            "p_country": body.country,
            "p_clinic_id": target_clinic_id,
            "p_specialization": body.specialization,
            "p_license_number": body.license_number,
            "p_hospital_affiliation": body.hospital_affiliation,
            "p_years_of_experience": body.years_of_experience,
            "p_employee_id": body.employee_id,
            "p_department": body.department,
            "p_designation": body.designation,
        }).execute()
    except Exception as e:
        try:
            await admin.auth.admin.delete_user(user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Staff creation failed: {e}")

    return success_response({
        "user_id": user_id,
        "role": body.role,
        "clinic_id": target_clinic_id,
        "clinic_name": clinic.get("clinic_name"),
    }, f"{body.role.replace('_', ' ').title()} registered successfully", status_code=201)


@router.put("/staff/{staff_id}")
@limiter.limit("20/minute")
async def update_staff(
    request: Request,
    staff_id: str,
    body: UpdateStaffRequest,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    profile = await _row(admin, "profiles", "id", staff_id)
    if not profile or profile.get("role") not in STAFF_ROLES:
        raise NotFoundError("Staff member not found")

    profile_updates = {}
    for f in ("full_name", "phone", "city", "state"):
        v = getattr(body, f, None)
        if v is not None:
            profile_updates[f] = v

    role_updates = {}
    if profile["role"] == "doctor":
        for f in ("specialization", "license_number", "hospital_affiliation", "years_of_experience", "availability"):
            v = getattr(body, f, None)
            if v is not None:
                role_updates[f] = v
    elif profile["role"] in ("receptionist", "clinical_assistant"):
        for f in ("employee_id", "department", "designation"):
            v = getattr(body, f, None)
            if v is not None:
                role_updates[f] = v

    if profile_updates:
        await admin.table("profiles").update(profile_updates).eq("id", staff_id).execute()
    if role_updates:
        table = {"doctor": "doctors", "receptionist": "receptionists",
                 "clinical_assistant": "clinical_assistants"}[profile["role"]]
        await admin.table(table).update(role_updates).eq("id", staff_id).execute()

    return success_response({"staff_id": staff_id}, "Staff member updated")


@router.put("/staff/{staff_id}/deactivate")
@limiter.limit("20/minute")
async def deactivate_staff(
    request: Request,
    staff_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    profile = await _row(admin, "profiles", "id", staff_id)
    if not profile or profile.get("role") not in STAFF_ROLES:
        raise NotFoundError("Staff member not found")
    await admin.table("profiles").update({"is_active": False}).eq("id", staff_id).execute()
    _invalidate_profile_cache(staff_id)
    return success_response({"staff_id": staff_id}, "Staff member deactivated")


@router.put("/staff/{staff_id}/reactivate")
@limiter.limit("20/minute")
async def reactivate_staff(
    request: Request,
    staff_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    profile = await _row(admin, "profiles", "id", staff_id)
    if not profile or profile.get("role") not in STAFF_ROLES:
        raise NotFoundError("Staff member not found")
    await admin.table("profiles").update({"is_active": True}).eq("id", staff_id).execute()
    _invalidate_profile_cache(staff_id)
    return success_response({"staff_id": staff_id}, "Staff member reactivated")


@router.delete("/staff/{staff_id}")
@limiter.limit("10/minute")
async def delete_staff(
    request: Request,
    staff_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    profile = await _row(admin, "profiles", "id", staff_id)
    if not profile or profile.get("role") not in STAFF_ROLES:
        raise NotFoundError("Staff member not found")

    role_table = {"doctor": "doctors", "receptionist": "receptionists",
                  "clinical_assistant": "clinical_assistants"}[profile["role"]]
    role_row = await _row(admin, role_table, "id", staff_id)
    if role_row and role_row.get("deleted_by"):
        raise BadRequestError("Staff member is already deleted")

    now = datetime.now(timezone.utc).isoformat()
    await admin.table(role_table).update({
        "deleted_by": current_user["id"],
        "deleted_at": now,
    }).eq("id", staff_id).execute()
    await admin.table("profiles").update({"is_active": False}).eq("id", staff_id).execute()
    _invalidate_profile_cache(staff_id)

    return success_response({"staff_id": staff_id}, "Staff member deleted")


# ---------------------------------------------------------------------------
# Patient management — global (all clinics)
# ---------------------------------------------------------------------------

@router.get("/patients")
@limiter.limit("60/minute")
async def list_patients(
    request: Request,
    clinic_id: Optional[str] = None,
    approval_status: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()

    q = admin.table("patients").select(
        "id, assigned_doctor_id, clinic_id, approval_status, created_at, medical_history, emergency_contact, "
        "deleted_by, deleted_at, "
        "profiles(id, full_name, email, phone, city, state, is_active), "
        "clinics(clinic_name)"
    ).is_("deleted_by", "null")

    if clinic_id:
        q = q.eq("clinic_id", clinic_id)
    if approval_status:
        q = q.eq("approval_status", approval_status)

    result = await q.order("created_at", desc=True).range(skip, skip + limit - 1).execute()
    raw = result.data or []

    data = []
    for p in raw:
        prof = p.pop("profiles") or {}
        clinic_join = p.pop("clinics") or {}
        data.append({**p, **prof, "clinic_name": clinic_join.get("clinic_name", "—")})

    if search:
        s = search.lower()
        data = [p for p in data if s in (p.get("full_name") or "").lower()
                or s in (p.get("email") or "").lower()]

    doctor_ids = list({p["assigned_doctor_id"] for p in data if p.get("assigned_doctor_id")})
    doctor_names = {}
    if doctor_ids:
        dr_profiles = (await admin.table("profiles").select("id, full_name").in_("id", doctor_ids).execute()).data or []
        doctor_names = {d["id"]: d["full_name"] for d in dr_profiles}

    for p in data:
        p["assigned_doctor_name"] = doctor_names.get(p.get("assigned_doctor_id"), "—")

    return paginated_response(data, len(data), skip, limit)


@router.put("/patients/{patient_id}/approve")
@limiter.limit("30/minute")
async def approve_patient(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    patient = await _row(admin, "patients", "id", patient_id)
    if not patient:
        raise NotFoundError("Patient not found")

    await admin.table("patients").update({"approval_status": "approved"}).eq("id", patient_id).execute()
    await admin.table("profiles").update({"is_active": True}).eq("id", patient_id).execute()
    return success_response({"patient_id": patient_id}, "Patient approved")


@router.put("/patients/{patient_id}/reject")
@limiter.limit("30/minute")
async def reject_patient(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    patient = await _row(admin, "patients", "id", patient_id)
    if not patient:
        raise NotFoundError("Patient not found")

    await admin.table("patients").update({"approval_status": "rejected"}).eq("id", patient_id).execute()
    await admin.table("profiles").update({"is_active": False}).eq("id", patient_id).execute()
    return success_response({"patient_id": patient_id}, "Patient rejected")


@router.delete("/patients/{patient_id}")
@limiter.limit("10/minute")
async def delete_patient(
    request: Request,
    patient_id: str,
    current_user: dict = Depends(require_admin),
):
    admin = get_supabase_admin()
    patient = await _row(admin, "patients", "id", patient_id)
    if not patient:
        raise NotFoundError("Patient not found")
    if patient.get("deleted_by"):
        raise BadRequestError("Patient is already deleted")

    now = datetime.now(timezone.utc).isoformat()
    await admin.table("patients").update({
        "deleted_by": current_user["id"],
        "deleted_at": now,
    }).eq("id", patient_id).execute()
    await admin.table("profiles").update({"is_active": False}).eq("id", patient_id).execute()

    return success_response({"patient_id": patient_id}, "Patient deleted")
