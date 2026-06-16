# NeuroWellness — User Flow Optimization & Profile Design Plan

**Date:** 2026-05-07  
**Scope:** Receptionist · Patient · Doctor · Admin  
**Based on:** Latest code review of `neurowellness-backend-v1` + `prs-neurowellness` after both teams' pushes

---

## Part 1 — What's Working Well

The latest sprint delivered solid foundations:
- Receptionist dashboard, approvals, patients list, patient detail, and profile pages are all built and functional in the Next.js frontend
- Backend registration is now atomic via RPC (`register_patient_db`, `register_staff_db`)
- Race condition on doctor count fixed (`increment_doctor_patient_count` RPC)
- `clinic_id` added to sessions, permissions, instances — data isolation is now enforced
- Admin list endpoints fixed from N+1 to batched queries
- JWKS cache has a TTL — auth will survive key rotation

---

## Part 2 — Active Bugs & Broken Flows (Fix This Week)

These are real breakages in the current code that will cause user-facing failures.

### Bug 1 — Register Patient Modal Has No Password Field (Critical)

**Where:** `prs-neurowellness/src/app/(roles)/receptionist/patients/page.tsx`  
**What:** `RegisterPatientPayload` in `staff.service.ts` does not include `password`. The backend `RegisterPatientRequest` requires `password` as a mandatory field. Every staff-side patient registration attempt will fail with a 422 Unprocessable Entity.

**Fix:**
- Add `password` field to `RegisterPatientPayload` in `staff.service.ts`
- Add `password` field to the registration modal form in `patients/page.tsx`
- Add `medical_history` and `emergency_contact` optional fields to the modal form (these are accepted by the backend but never sent from the frontend)

---

### Bug 2 — Reject Reason Is Captured But Never Stored

**Where:** `prs-neurowellness/src/app/(roles)/receptionist/approvals/page.tsx`  
**What:** The frontend collects a rejection reason from the receptionist and sends it as `{ reason }` in the PUT body. The backend `reject_patient` endpoint signature is `async def reject_patient(request, patient_id, current_user)` — it does not accept a body at all. The reason is silently dropped.

**Fix:**
- Add a `RejectPatientRequest` Pydantic model to `staff.py` with `reason: Optional[str]`
- Store the reason in the `patients` table as a `rejection_reason` column
- Send a notification email or in-app notification to the patient with the reason

---

### Bug 3 — Hard Delete on Staff Reject vs Soft Reject on Admin Reject (Inconsistency)

**Where:** `staff.py` `reject_patient` vs `admin.py` `reject_patient`  
**What:** The admin's reject sets `approval_status=rejected`, `is_active=False` (soft). The receptionist/staff reject permanently hard-deletes the auth user + profile + patient row. The same action has completely different consequences depending on who performs it — and the hard delete loses data forever.

**Fix (align both to soft reject):**
```python
# staff.py — change to soft reject (same as admin.py)
admin.table("patients").update({"approval_status": "rejected", "rejection_reason": body.reason}).eq("id", patient_id).execute()
admin.table("profiles").update({"is_active": False}).eq("id", patient_id).execute()
# Do NOT call admin.auth.admin.delete_user()
```

---

### Bug 4 — `registered_today` Missing From Backend Dashboard

**Where:** `staff.py` `staff_dashboard`  
**What:** The receptionist dashboard tries `summary?.registered_today` but this field is never returned by the backend. It falls back to a client-side count by filtering on `created_at`, but timezone handling makes this unreliable (IST vs UTC).

**Fix:** Add to backend:
```python
today = datetime.utcnow().date().isoformat()
registered_today = admin.table("patients").select("id").eq("clinic_id", clinic_id)\
    .gte("created_at", f"{today}T00:00:00").execute()
patients_summary["registered_today"] = len(registered_today.data or [])
```

---

### Bug 5 — No `/users/profile` Backend Endpoint

**Where:** `prs-neurowellness/src/lib/api/services/users.service.ts`  
**What:** The receptionist profile page calls `usersService.getProfile()`. The users service calls a `/users/profile` endpoint that does not exist in the backend router. The page silently falls back to `authUser` from the JWT, which has limited data.

**Fix:** Add a `GET /users/me` endpoint in a new `users.py` router (or extend `auth.py`) that returns the full profile including role-specific table data and clinic info. This also powers the doctor, patient, and clinical assistant profile pages.

---

### Bug 6 — Patient Detail Page Missing Medical History and Sessions

**Where:** `prs-neurowellness/src/app/(roles)/receptionist/patients/[id]/page.tsx`  
**What:** The backend `GET /staff/patients/{id}` returns `patient.medical_history`, `patient.emergency_contact`, and `recent_sessions[]` — but the frontend patient detail only renders contact info and the doctor allocation card. Medical history and sessions are fetched and then discarded.

**Fix:** Add two more sections to the patient detail page:
1. **Medical Information** card: `medical_history`, `emergency_contact`, `blood_group` (future)
2. **Session History** card: table of `recent_sessions` with date, status, session type

---

## Part 3 — User Flow Optimizations Per Role

### 3A — Receptionist Flow

**Current flow:**  
Dashboard → (Approvals or Patients) → Patient Detail → Allocate Doctor

**Optimized flow:**

```
Dashboard
  ├── Pending Approvals badge (if > 0, highlighted)
  ├── Stats: Total Patients | Pending Approvals | Registered Today
  └── Quick actions: Register Patient | View Pending

Approvals Page
  ├── List of pending self-registrations
  ├── Per card: name, email, phone, DOB, registered date
  ├── Approve → auto-allocates doctor + activates account
  └── Reject → modal with reason field (soft reject, stores reason, notifies patient)

Patients Page
  ├── Filter tabs: All | Approved | Pending | Rejected
  ├── Search: name, email, phone, MRN
  ├── Register Patient button → modal (with password + medical fields)
  └── Click row → Patient Detail

Patient Detail
  ├── Header: name, MRN, status badge, clinic
  ├── Tab 1 — Personal Info: contact, DOB, gender, address, location
  ├── Tab 2 — Medical Info: medical_history, emergency_contact, blood_group, allergies
  ├── Tab 3 — Doctor Allocation: current doctor + reassign dropdown
  └── Tab 4 — Sessions: timeline of recent sessions with status
  
  Actions (visible based on status):
  ├── Pending: Approve button + Reject button
  ├── Approved: Reallocate Doctor button
  └── All: View Full Medical Record (doctor-only link — greyed out for receptionist)

My Profile (read + edit)
  ├── View all personal fields
  └── Edit button → inline edit for: name, phone, city, state, employee_id, department
```

**Missing screens to build:**
- Schedule / Today's Sessions (timeline view of sessions for receptionist's clinic today)
- Notifications page (all approval/rejection/allocation events)

---

### 3B — Patient Flow

**Current state:** Patient self-registration and login exist. Patient portal screens are largely undefined.

**Optimized flow:**

```
Self-Registration
  ├── Step 1: Personal — name, email, phone, DOB, gender
  ├── Step 2: Location — city, state, country, select clinic
  ├── Step 3: Medical — medical_history, emergency_contact (optional)
  └── Confirmation screen: "Pending approval — we'll notify you by email"

Patient Login (blocked with ACCOUNT_PENDING_APPROVAL error)
  └── Show: "Your registration is pending clinic approval. You'll receive an email once approved."
  
Patient Dashboard (after approval)
  ├── Welcome banner with assigned doctor name
  ├── Pending assessments list (from assessment_permissions)
  ├── Last assessment result summary
  └── Next session date (if scheduled)

Patient Profile (read + limited edit)
  ├── Personal Info: name, email (read-only), phone, DOB, gender
  ├── Contact Info: city, state, country, address
  ├── Medical Info: medical_history, emergency_contact, blood_group, allergies
  ├── My Doctor: doctor name, specialization, contact
  └── Edit allowed for: phone, address fields, emergency_contact

Assessments Page
  ├── List of granted assessment permissions
  ├── Each row: disease name, granted date, status (granted/completed/expired)
  └── Start Assessment button (if granted)

Results Page
  ├── History of completed assessments
  └── Per result: disease, date, severity, scale breakdown
```

---

### 3C — Doctor Flow

**Current state:** Doctor dashboard and patient list exist in the Vite frontend (Mohan's). The Next.js frontend has some doctor routes but they're incomplete.

**Optimized flow:**

```
Doctor Dashboard
  ├── Stats: My Patients | Pending Assessments | Sessions Today
  ├── Today's sessions timeline
  ├── Recent assessment results list
  └── Patients with pending assessment grants needing review

My Patients
  ├── Filter: All | Assessment Pending | Assessment Granted | Assessment Completed
  ├── Search by name, MRN
  └── Click → Patient Full Detail

Patient Full Detail (doctor view — richer than receptionist view)
  ├── All tabs from receptionist view +
  ├── Tab 5 — Assessments: all permissions, instances, scores
  ├── Tab 6 — Anamnesis: read-only view of anamnesis intake form
  └── Actions: Grant Assessment (permission) | View Score Details

Doctor Profile (read + edit)
  ├── Personal: name, phone, city, state
  ├── Professional: specialization, license_number, hospital_affiliation, years_experience
  ├── Availability: toggle available/unavailable, max_patients
  └── Working Hours (future): per-day schedule grid

Availability Management
  ├── Toggle availability status (available/on_leave/unavailable)
  └── Set max patient load
```

---

### 3D — Admin Flow

**Current state:** Admin dashboard, clinic list, staff list, staff register, patient list all exist in Vite frontend.

**Optimized flow:**

```
Admin Dashboard
  ├── Global stats: clinics, doctors, receptionists, CAs, patients, pending approvals
  ├── Pending approvals count with one-click navigate
  ├── Clinic breakdown table
  └── Quick actions: Add Clinic | Register Staff | View Patients

Clinics Management
  ├── List with status badges and per-clinic stats
  ├── Clinic detail page: staff list + patient count + contact info
  └── Edit clinic info | Deactivate/Activate

Staff Management
  ├── Filter: All | Doctor | Receptionist | Clinical Assistant | Active | Inactive
  ├── Search by name, clinic
  ├── Register Staff button (role picker + form)
  ├── Staff detail: full profile view
  └── Edit | Deactivate | Reactivate

Patients (Global)
  ├── Filter by clinic, approval_status, search
  ├── Approve / Reject from list
  └── View patient detail (read-only)

Admin Profile
  ├── Personal info
  └── Clinic assignment info
```

---

## Part 4 — Profile Data Fields (Comprehensive)

These are the fields each role should be able to view and/or edit in their profile section. Fields marked with `DB` need to be added to the database. Fields marked with `exists` are already in the schema.

---

### 4A — Patient Profile Fields

| Section | Field | DB Status | Editable by Patient |
|---------|-------|-----------|---------------------|
| **Identity** | Full Name | exists | No (admin only) |
| | Email Address | exists | No |
| | Phone Number | exists | Yes |
| | Date of Birth | exists (add `DATE` col) | No (admin only) |
| | Gender | exists (add col) | No |
| | MRN (Medical Record Number) | DB — add to `patients` | No (system-generated) |
| **Location** | Address Line 1 | DB — add to `profiles` | Yes |
| | City | exists | Yes |
| | State | exists | Yes |
| | Country | exists | Yes |
| | Pincode / ZIP | DB — add to `profiles` | Yes |
| **Medical** | Blood Group | DB — add to `patients` | Yes |
| | Known Allergies | DB — add to `patients` | Yes |
| | Current Medications | exists in anamnesis | Yes |
| | Medical History / Conditions | exists | Yes |
| | Emergency Contact (Name + Phone) | exists | Yes |
| | Primary Language | DB — add to `profiles` | Yes |
| **Insurance** | Insurance Provider | DB — add to `patients` | Yes |
| | Policy Number | DB — add to `patients` | Yes |
| **Social** | Occupation | DB — add to `patients` | Yes |
| | Marital Status | DB — add to `patients` | Yes |
| | Referred By | DB — add to `patients` | Yes |
| **Clinic** | Assigned Clinic | exists | No |
| | Assigned Doctor | exists | No |
| | Registration Date | exists (`created_at`) | No |
| | Approval Status | exists | No |

---

### 4B — Doctor Profile Fields

| Section | Field | DB Status | Editable by Doctor |
|---------|-------|-----------|---------------------|
| **Identity** | Full Name | exists | No (admin only) |
| | Email Address | exists | No |
| | Phone Number | exists | Yes |
| | Date of Birth | DB — add to `profiles` | No |
| | Gender | DB — add to `profiles` | No |
| | Profile Photo / Avatar | DB — add `avatar_url` to `profiles` | Yes |
| **Location** | City | exists | Yes |
| | State | exists | Yes |
| **Professional** | Specialization | exists in `doctors` | Yes |
| | License Number | exists | Yes |
| | Medical Council Registration | DB — add to `doctors` | Yes |
| | Hospital Affiliation | exists | Yes |
| | Years of Experience | exists | Yes |
| | Qualification / Degrees | DB — add to `doctors` (text array) | Yes |
| | Languages Spoken | DB — add to `doctors` (text array) | Yes |
| | Short Bio / About | DB — add to `doctors` | Yes |
| **Availability** | Availability Status | exists (`doctors.availability`) | Yes |
| | Max Patient Load | exists (`doctors.max_patients`) | Yes |
| | Working Days | DB — add to `doctors` (jsonb) | Yes |
| | Working Hours | DB — add to `doctors` (jsonb) | Yes |
| **Clinic** | Assigned Clinic | exists | No (admin only) |
| | Current Patient Count | exists | No (system) |
| | Employee ID | DB — add to `doctors` (optional) | No |

---

### 4C — Receptionist Profile Fields

| Section | Field | DB Status | Editable by Receptionist |
|---------|-------|-----------|--------------------------|
| **Identity** | Full Name | exists | No (admin only) |
| | Email Address | exists | No |
| | Phone Number | exists | Yes |
| | Date of Birth | DB — add to `profiles` | No |
| | Gender | DB — add to `profiles` | No |
| | Profile Photo / Avatar | DB — add `avatar_url` | Yes |
| **Location** | City | exists | Yes |
| | State | exists | Yes |
| **Employment** | Employee ID | exists in `receptionists` | No (admin only) |
| | Department | exists | Yes |
| | Designation | exists | Yes |
| | Date of Joining | DB — add to `receptionists` | No |
| | Languages Spoken | DB — add to `receptionists` | Yes |
| **Clinic** | Assigned Clinic | exists | No (admin only) |
| | Clinic Address | from `clinics` table | No |
| | Clinic Phone | from `clinics` table | No |

---

### 4D — Admin Profile Fields

| Section | Field | DB Status | Editable by Admin |
|---------|-------|-----------|-------------------|
| **Identity** | Full Name | exists | Yes |
| | Email Address | exists | No |
| | Phone Number | exists | Yes |
| **Employment** | Admin Level | DB — add `admin_level` to `admins` | No |
| | Assigned Clinics | exists | No |
| | Date of Joining | DB — add to `admins` | No |
| **Access** | Roles & Permissions | from JWT | No |

---

## Part 5 — New Backend Endpoints Needed

| Endpoint | Method | Description | Priority |
|----------|--------|-------------|----------|
| `GET /users/me` | GET | Full profile for current user (all roles) | 🔴 This week |
| `PUT /users/me` | PUT | Update own editable profile fields | 🔴 This week |
| `PUT /users/me/avatar` | PUT | Upload profile photo | 🟡 Next sprint |
| `GET /staff/patients/{id}/sessions` | GET | Session history for a patient | 🔴 This week |
| `GET /staff/schedule/today` | GET | Today's sessions for receptionist's clinic | 🟡 Next sprint |
| `PUT /staff/patients/{id}/reject` | PUT | Accept `reason` body, soft delete | 🔴 This week (bug fix) |
| `GET /doctor/patients/{id}` | GET | Full patient detail for doctor (incl. anamnesis) | 🟡 Next sprint |
| `PUT /doctor/me/availability` | PUT | Doctor sets their availability status | 🟡 Next sprint |
| `GET /patient/me/dashboard` | GET | Patient's own dashboard data | 🟡 Next sprint |
| `GET /patient/me/assessments` | GET | Patient's granted + completed assessments | 🟡 Next sprint |

---

## Part 6 — New DB Columns Needed

Run these migrations in Supabase SQL Editor:

```sql
-- Profiles: common fields for all roles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url        TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth     DATE,
  ADD COLUMN IF NOT EXISTS gender            TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS address_line1     TEXT,
  ADD COLUMN IF NOT EXISTS pincode           TEXT,
  ADD COLUMN IF NOT EXISTS language_pref     TEXT DEFAULT 'en';

-- Patients: extended clinical and administrative fields
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS mrn               TEXT UNIQUE,  -- Medical Record Number
  ADD COLUMN IF NOT EXISTS blood_group       TEXT CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown')),
  ADD COLUMN IF NOT EXISTS allergies         TEXT,
  ADD COLUMN IF NOT EXISTS occupation        TEXT,
  ADD COLUMN IF NOT EXISTS marital_status    TEXT CHECK (marital_status IN ('single','married','divorced','widowed','other')),
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy  TEXT,
  ADD COLUMN IF NOT EXISTS referred_by       TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;  -- for soft-reject

-- Auto-generate MRN on insert
CREATE SEQUENCE IF NOT EXISTS mrn_seq START 10001;
CREATE OR REPLACE FUNCTION generate_mrn() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mrn IS NULL THEN
    NEW.mrn := 'NW-' || LPAD(nextval('mrn_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_mrn BEFORE INSERT ON patients FOR EACH ROW EXECUTE FUNCTION generate_mrn();

-- Doctors: extended professional fields
ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS bio               TEXT,
  ADD COLUMN IF NOT EXISTS qualification     TEXT[],   -- e.g. ['MBBS', 'MD - Neurology']
  ADD COLUMN IF NOT EXISTS languages         TEXT[],   -- e.g. ['English', 'Hindi', 'Marathi']
  ADD COLUMN IF NOT EXISTS working_hours     JSONB,    -- {"mon": {"start": "09:00", "end": "17:00"}, ...}
  ADD COLUMN IF NOT EXISTS medical_council_reg TEXT;

-- Receptionists: extended fields
ALTER TABLE receptionists
  ADD COLUMN IF NOT EXISTS date_of_joining   DATE,
  ADD COLUMN IF NOT EXISTS languages         TEXT[];

-- Admins: extended fields
ALTER TABLE admins
  ADD COLUMN IF NOT EXISTS admin_level       TEXT DEFAULT 'clinic' CHECK (admin_level IN ('clinic', 'global')),
  ADD COLUMN IF NOT EXISTS date_of_joining   DATE;
```

---

## Part 7 — UI/UX Improvements Per Screen

### Receptionist Dashboard
- **Add:** "Registered Today" as a stat card (needs backend fix from Bug 4 above)
- **Add:** Color-coded urgency on pending approvals (red if > 5, amber if 1–5, green if 0)
- **Add:** Quick-action floating button or top-bar "Register Patient" shortcut
- **Move:** Sessions section below approvals (approvals are more urgent)
- **Change:** Dashboard greeting should use `user.full_name` not `user.first_name` (first_name doesn't exist in the backend user model — it's `full_name`)

### Approvals Page
- **Add:** Patient's city/state under name (helps receptionist verify they're registering at the right clinic)
- **Add:** "Registered X minutes/hours ago" relative timestamp
- **Add:** Bulk approve button when all look valid (select all + approve)
- **Fix:** Rejection modal title says "Reject Registration" but should say "Reject & Notify" to make it clear the patient will be informed

### Patients List
- **Add:** MRN column (once MRN is generated)
- **Add:** Assigned Doctor column (name)
- **Fix:** Status filter shows `approved/pending/rejected` but the `PatientListItem.status` is mapped from `approval_status` — verify this mapping doesn't produce `undefined`
- **Add:** Export CSV button (list of patients for the receptionist's clinic)

### Patient Detail
- **Add:** Tabs (instead of stacked cards) — Personal Info | Medical Info | Doctor | Sessions
- **Add:** Medical Info tab: medical_history, emergency_contact, blood_group, allergies
- **Add:** Sessions tab: chronological list of sessions
- **Change:** "Allocate Doctor" card should show the currently allocated doctor first, with a "Reassign" button
- **Add:** MRN displayed prominently in header (once implemented)

### Profile Page (Receptionist)
- **Add:** Edit button that opens inline edit mode for allowed fields
- **Add:** Avatar upload (image or initials avatar with color picker)
- **Fix:** "Clinic Information" section currently shows "not available" in many cases — this needs the `GET /users/me` endpoint to return `clinic_name` and `clinic_city` properly

---

## Part 8 — Priority Order for Next Two Sprints

### Sprint 1 — This Week (Bug Fixes + Critical Missing Pieces)

| Task | Who | Type |
|------|-----|------|
| Add `password` field to Register Patient modal | Frontend | Bug fix |
| Fix reject to soft-delete + store reason (backend + frontend) | Backend + Frontend | Bug fix |
| Add `registered_today` to staff dashboard response | Backend | Bug fix |
| Build `GET /users/me` and `PUT /users/me` endpoints | Backend | New endpoint |
| Add Medical Info + Sessions tabs to Patient Detail | Frontend | Feature |
| Add `rejection_reason` column to `patients` table | Backend/DB | Migration |
| Add `mrn` column with auto-generator trigger | Backend/DB | Migration |
| Wire profile page edit functionality (receptionist) | Frontend | Feature |

### Sprint 2 — Next Week (Profile + Doctor Flow)

| Task | Who | Type |
|------|-----|------|
| Add all new DB columns (blood_group, allergies, address_line1, etc.) | Backend/DB | Migration |
| Build Patient Profile page (patient-facing, read + edit own fields) | Frontend | New screen |
| Build Doctor Profile page (with availability toggle) | Frontend | New screen |
| Build `PUT /doctor/me/availability` endpoint | Backend | New endpoint |
| Add avatar upload support | Backend + Frontend | Feature |
| Build Patient Dashboard (patient-facing) | Frontend | New screen |
| Build Today's Schedule screen for receptionist | Frontend | New screen |
| Add `GET /staff/schedule/today` endpoint | Backend | New endpoint |

---

## Part 9 — API Contract for `GET /users/me` (Most Urgent Endpoint)

This endpoint is the single most critical missing piece — it blocks all profile pages across all roles.

**Endpoint:** `GET /users/me`  
**Auth:** Any authenticated role  
**Response shape (merged profile + role table + clinic):**

```json
{
  "id": "uuid",
  "role": "receptionist",
  "full_name": "Priya Menon",
  "email": "priya@clinic.com",
  "phone": "+91 98765 43210",
  "date_of_birth": "1992-04-15",
  "gender": "female",
  "avatar_url": null,
  "city": "Pune",
  "state": "Maharashtra",
  "country": "India",
  "is_active": true,
  "clinic_id": "uuid",
  "clinic_name": "NeuroWellness Kharadi",
  "clinic_city": "Pune",
  "clinic_address": "3rd Floor, Phoenix Mall, Kharadi",
  "created_at": "2026-01-10T09:00:00Z",
  
  // Role-specific fields (only for their role):
  "employee_id": "EMP-042",
  "department": "Front Desk",
  "designation": "Senior Receptionist",
  
  // For doctors:
  // "specialization": "Neurology",
  // "license_number": "MCI-12345",
  // "availability": "available",
  // "current_patient_count": 24,
  // "max_patients": 50,
  
  // For patients:
  // "medical_history": "...",
  // "emergency_contact": "...",
  // "approval_status": "approved",
  // "assigned_doctor_name": "Dr. Arjun Sharma"
}
```

**Backend implementation (add to `auth.py` or new `users.py`):**
```python
@router.get("/users/me")
async def get_my_profile(request: Request, current_user: dict = Depends(get_current_user)):
    admin = get_supabase_admin()
    profile = _get_full_profile(admin, current_user["id"])
    if not profile:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")
    
    # Enrich with clinic info
    if profile.get("clinic_id"):
        clinic = _row(admin, "clinics", "clinic_id", profile["clinic_id"])
        if clinic:
            profile["clinic_name"] = clinic.get("clinic_name")
            profile["clinic_city"] = clinic.get("city")
            profile["clinic_address"] = clinic.get("address")
    
    # For patients, add assigned doctor name
    if profile.get("role") == "patient" and profile.get("assigned_doctor_id"):
        doc_profile = _row(admin, "profiles", "id", profile["assigned_doctor_id"])
        profile["assigned_doctor_name"] = doc_profile.get("full_name") if doc_profile else None
    
    return success_response(profile)
```

---

## Summary

| Category | Issues Found | Bugs | Optimizations |
|----------|-------------|------|---------------|
| Registration flow | 2 bugs | Password missing, reject hard-delete | Soft reject with reason + notification |
| Dashboard | 1 bug | `registered_today` missing from backend | Add stat, fix greeting field |
| Profile pages | 1 bug | No `/users/me` endpoint | Build full profile with edit |
| Patient detail | 1 gap | Medical history + sessions not shown | Add tabs |
| DB schema | 8 new columns | MRN missing | Add clinical fields for all roles |
| Doctor flow | Not started | — | Full profile + availability management |
| Patient portal | Not started | — | Self-service dashboard + assessment list |

The highest-leverage fix is implementing `GET /users/me` + `PUT /users/me` — it unblocks the profile page for every single role. The most important bug fix is the missing password field in the register patient modal — without it, staff cannot register a single patient from the new frontend.
