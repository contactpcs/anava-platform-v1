# Appointment Booking & Scheduling System — NeuroWellness Platform

> **Production-grade end-to-end implementation plan for the appointment, scheduling, and real-time notification module across the NeuroWellness PRS application.**
>
> Backend: `neurowellness-backend-v1` (FastAPI + Supabase PostgreSQL)
> Frontend: `prs-neurowellness` (Next.js 14 App Router + Redux Toolkit)
> Target audience: Engineering team building the entire appointment module from scratch.

---

## ⚠️ IMPORTANT — Patient Booking Model

**Patients do NOT have direct access to the doctor's schedule or self-booking slots.** This is a deliberate clinical/operational policy decision:

- The doctor's schedule is visible **only to**: **doctor, receptionist, clinical assistant, admin**.
- A patient **requests** an appointment through the app (with preferred date(s), time window, and complaint).
- The **receptionist reviews each request** and **assigns it against the doctor's actual schedule** (picks a real slot and approves the request → an appointment is created).
- A patient **can cancel** their confirmed appointment (with 2-hour-before-start cut-off).
- A patient **can request a reschedule** of their confirmed appointment; the receptionist reviews and assigns a new slot.
- All other roles (doctor, receptionist, clinical assistant) operate against actual slots directly.

This document reflects that workflow throughout.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [System Architecture](#3-system-architecture)
4. [Technology Stack & Required Packages](#4-technology-stack--required-packages)
5. [Database Schema (Supabase PostgreSQL)](#5-database-schema-supabase-postgresql)
6. [Backend Implementation (FastAPI)](#6-backend-implementation-fastapi)
7. [Real-Time Layer — Socket.IO Integration](#7-real-time-layer--socketio-integration)
8. [Background Jobs & Reminders](#8-background-jobs--reminders)
9. [REST API Specification](#9-rest-api-specification)
10. [Frontend Implementation (Next.js 14)](#10-frontend-implementation-nextjs-14)
11. [Calendar Integration](#11-calendar-integration)
12. [Notification & Toast System](#12-notification--toast-system)
13. [Multi-Tenancy (Clinic Scoping)](#13-multi-tenancy-clinic-scoping)
14. [Role-Based Workflows](#14-role-based-workflows)
15. [Security, Performance & Reliability](#15-security-performance--reliability)
16. [Testing Strategy](#16-testing-strategy)
17. [Deployment, DevOps & Observability](#17-deployment-devops--observability)
18. [Phased Implementation Roadmap](#18-phased-implementation-roadmap)
19. [File-by-File Reference](#19-file-by-file-reference)
20. [Acceptance Criteria](#20-acceptance-criteria)

---

## 1. Executive Summary

The NeuroWellness platform serves four primary clinical roles — **patient**, **doctor**, **receptionist**, and **clinical assistant** (plus admin) — across multiple clinics (multi-tenant via `clinic_id`). Today, the platform has user management, clinical assessment (PRS), anamnesis, doctor notes, and consent flows, but **no native appointment booking, scheduling, or real-time notification capability**.

This plan delivers a **production-grade appointment module** with **two distinct flows**:

- **Direct booking flow** — receptionist (or doctor/clinical assistant) creates an appointment directly against a known available slot in the doctor's schedule.
- **Patient request flow** — patient submits an `appointment_request` (preferred dates + time window + complaint); receptionist reviews, picks an actual slot from the doctor's schedule, and approves → system creates the appointment.

Additional capabilities:
- **Calendar-based scheduling** for doctors with recurring weekly availability + date-level overrides (leaves/holidays).
- **Doctor can view, edit, postpone, cancel, and block off** their own appointments via a calendar UI.
- **Patient can cancel** their appointment and **request a reschedule** (reschedule requests go through the same receptionist review flow).
- **Real-time updates** via Socket.IO — `appointment:*` and `appointment_request:*` events propagate live to all participants.
- **Reminder system** — automated 24 h and 1 h before notifications via APScheduler.
- **Multi-tenant clinic isolation** with Supabase RLS.
- **Append-only audit trail** for both appointments and requests.
- **Industry-standard stack** — `python-socketio` (ASGI) + `socket.io-client` v4, `FullCalendar` for the calendar UI, `APScheduler` for jobs, `Redis` for socket scale-out and rate-limit shared state.

The system is designed for **horizontal scale** (stateless FastAPI workers behind a load balancer, Redis-backed Socket.IO adapter for cross-node event fan-out) and **long-term maintainability** (clear service-layer boundaries, typed Pydantic + TypeScript contracts, OpenAPI auto-docs).

---

## 2. Goals & Non-Goals

### Goals
1. Receptionist can register a patient and book an appointment against any doctor's schedule **in the same clinic**.
2. Doctor can view, edit, postpone, cancel, and block off their own appointments via a calendar UI.
3. **Patient cannot self-book or view the doctor's schedule.** Patient submits an **appointment request** (preferred dates + time window + complaint); receptionist reviews and assigns it against an actual slot.
4. Patient can **cancel** their own confirmed appointment (subject to the 2-hour-before-start rule) and **request a reschedule**, which goes through the same receptionist-review flow.
5. Doctor / receptionist / clinical assistant **can view the doctor's schedule and pick slots directly** without going through the request flow.
6. Clinical assistant can view appointments and assist in their clinic.
7. **All four roles receive real-time notifications and toast pop-ups** on appointment-lifecycle events and request-lifecycle events.
8. Automated **reminders** (24 h before, 1 h before) sent via in-app notifications + socket.
9. **No double-booking** — DB-level constraint + transactional check.
10. **Multi-tenant safe** — patients/staff in clinic A never see clinic B doctors / slots / requests.
11. Append-only audit trail for every appointment and request state change.
12. Mobile-responsive UI; works on tablets used at reception desks.

### Non-Goals (out of scope for V1)
- **Patient self-booking against doctor's live schedule.** Explicitly excluded by design.
- SMS / Email reminders. The architecture leaves a clean hook for adding these later via a `Notifier` interface.
- Payment / billing integration.
- Telemedicine video calls (the `appointment_type=video` flag is reserved for future).
- Calendar sync to external providers (Google / Outlook). Plan leaves room for iCal feed export.
- Recurring patient appointments (every Monday for 6 weeks). V1 supports single-instance bookings only.

---

## 3. System Architecture

### 3.1 High-Level Diagram (textual)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Next.js 14 Frontend                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│   │  Patient UI  │  │  Doctor UI   │  │ Recept. UI   │  │  Clin.Ast UI │    │
│   │  (request +  │  │  (calendar + │  │  (book +     │  │  (view +     │    │
│   │   cancel +   │  │   manage own │  │   review     │  │   assist)    │    │
│   │   request    │  │   schedule)  │  │   requests)  │  │              │    │
│   │   reschedule)│  │              │  │              │  │              │    │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│   No access to doctor's schedule    Full schedule + slot access              │
│          │                  │                  │                  │             │
│          └──────────────────┴───────┬──────────┴──────────────────┘             │
│                                     ▼                                            │
│   ┌───────────────────────────────────────────────────────────────────┐        │
│   │  Redux Toolkit Store  │  Axios REST Client  │  Socket.IO Client   │        │
│   │  (appointmentsSlice,  │  (Bearer JWT)        │  (real-time events) │        │
│   │   requestsSlice,      │                      │                      │        │
│   │   doctorScheduleSlice)│                      │                      │        │
│   └────────────────┬───────────────┬────────────────────┬──────────────┘        │
└────────────────────┼───────────────┼────────────────────┼───────────────────────┘
                     │ HTTPS / REST  │ HTTPS / REST       │ WSS (Socket.IO)
                     ▼               ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            FastAPI Backend (ASGI)                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │            socketio.ASGIApp  (wraps FastAPI + Socket.IO server)         │ │
│  │ ┌──────────────────────────┐  ┌────────────────────────────────────┐ │ │
│  │ │  FastAPI Routers          │  │  Socket.IO Server (AsyncServer)    │ │ │
│  │ │  /api/v1/appointments     │  │  Events:                            │ │ │
│  │ │  /api/v1/appointment-     │  │    appointment:created|...          │ │ │
│  │ │      requests             │  │    appointment_request:created|... │ │ │
│  │ │  /api/v1/schedule         │  │  Rooms: clinic:{id}, user:{id},    │ │ │
│  │ │  /api/v1/notifications    │  │         doctor:{id}, role:{role}   │ │ │
│  │ └──────────────────────────┘  └────────────────────────────────────┘ │ │
│  │                            │                                              │ │
│  │  ┌─────────────────────────▼─────────────────────────────────────────┐  │ │
│  │  │  Service Layer (business logic)                                    │  │ │
│  │  │   appointment_service │ request_service │ schedule_service │      │  │ │
│  │  │   notification_service                                              │  │ │
│  │  └─────────────────────────┬─────────────────────────────────────────┘  │ │
│  │                            │                                              │ │
│  │  ┌─────────────────────────▼─────────────────────────────────────────┐  │ │
│  │  │  APScheduler (in-process)  ── reminder jobs + expired-request GC   │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────┬─────────────────────────────────────────┘ │
└──────────────────────────────────┼─────────────────────────────────────────────┘
                                   │
              ┌────────────────────┴───────────────────┐
              ▼                                         ▼
   ┌──────────────────────┐              ┌─────────────────────────────┐
   │  Supabase PostgreSQL │              │  Redis (Socket.IO adapter + │
   │  - appointments      │              │   APScheduler job store +   │
   │  - appointment_      │              │   rate-limit storage)       │
   │    requests          │              └─────────────────────────────┘
   │  - doctor_schedules  │
   │  - schedule_overrides│
   │  - appointment_      │
   │    history           │
   │  - notifications     │
   │  Row-Level Security  │
   └──────────────────────┘
```

### 3.2 Two Booking Flows — High-Level Sequences

**Flow A — Direct booking by clinic staff (receptionist / clinical assistant / doctor / admin):**
```
Receptionist → POST /appointments  ──►  appointment_service.create_appointment()
                                          │ writes appointments + appointment_history
                                          │ emits appointment:created to clinic + user rooms
                                          ▼
                                        Patient sees toast + updated /patient/appointments
```

**Flow B — Patient-initiated request, reviewed by receptionist:**
```
Patient        → POST /appointment-requests  ──► request_service.create_request()
                                                  │ writes appointment_requests (status=pending)
                                                  │ emits appointment_request:created to clinic staff
                                                  ▼
Receptionist   inbox shows new request, opens it → sees patient's preferred dates + reads slots from
              doctor's schedule for those dates
Receptionist   → POST /appointment-requests/{id}/approve { appointment_date, start_time, … }
                                                  │ request_service.approve_request()
                                                  │  → calls appointment_service.create_appointment()
                                                  │  → updates request (status=approved, approved_appointment_id)
                                                  │  → emits appointment:created AND appointment_request:approved
                                                  ▼
Patient        receives toast "Your appointment has been confirmed for …"
```

**Flow C — Patient-initiated reschedule request:**
```
Patient → POST /appointments/{id}/request-reschedule { preferred_dates, time_window, reason }
              │ request_service.create_request(type='reschedule', parent_appointment_id=id)
              │ emits appointment_request:created (type=reschedule) to clinic staff
              ▼
Receptionist reviews, approves with a new slot:
        POST /appointment-requests/{request_id}/approve { appointment_date, start_time }
              │ creates new appointment with rescheduled_from = old_id
              │ cancels old appointment (status=rescheduled, rescheduled_to = new_id)
              │ emits appointment:rescheduled + appointment_request:approved
              ▼
Patient sees both old appointment marked rescheduled and new one in their list.
```

### 3.3 Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| **FastAPI routers** | HTTP endpoints, request validation (Pydantic), auth (JWT) |
| **`appointment_service`** | CRUD on appointments; status transitions; conflict checks |
| **`request_service`** | CRUD on appointment_requests; approval flow that delegates to `appointment_service.create_appointment` |
| **`schedule_service`** | Slot generation, doctor weekly schedule + overrides |
| **Socket.IO server** | Real-time event fan-out to rooms; JWT auth on connect |
| **APScheduler** | Scheduled jobs: reminder dispatch, expired-request GC, no-show flagging |
| **Supabase** | Persistence + RLS for clinic isolation |
| **Redis** | Socket.IO multi-node adapter + APScheduler jobstore + slowapi rate-limit |
| **Next.js layout providers** | `<SocketProvider>` mounts a single Socket.IO client per authenticated session |
| **Redux slices** | `appointmentsSlice`, `appointmentRequestsSlice`, `doctorScheduleSlice` |
| **Axios client** | Existing `src/lib/api/client.ts`; appointment + request endpoints added |

### 3.4 Why this stack (industry standards)

| Choice | Rationale |
|--------|-----------|
| `python-socketio` + `socket.io-client` v4 | De-facto standard, auto-reconnect, room/namespace support, JS client maintained by same authors. Works seamlessly under ASGI. |
| FullCalendar (`@fullcalendar/react`) | Most mature React calendar — month/week/day/list/timeGrid views, drag-drop, RTL, accessibility, used by Microsoft Bookings and Calendly clones. MIT licence. |
| APScheduler with Redis jobstore | In-process scheduler that survives restarts when backed by Redis. Simpler than Celery for reminder + GC tasks. Trivially upgradable to Celery later. |
| Supabase RLS | Database-level multi-tenant isolation that survives application bugs. |
| Redis adapter for Socket.IO | Enables horizontal scaling — emit from any worker reaches any client. |
| Pydantic v2 + TypeScript | Type contracts on both ends; OpenAPI spec auto-generated and consumable by `openapi-typescript` if the team wants generated clients later. |

---

## 4. Technology Stack & Required Packages

### 4.1 Backend — Python packages to add to `neurowellness/backend/requirements.txt`

```
# Real-time
python-socketio>=5.11.0,<6
python-engineio>=4.9.0,<5

# Background jobs
APScheduler>=3.10.4,<4

# Date math (timezone-aware slot generation)
python-dateutil>=2.9.0

# Redis (Socket.IO multi-node adapter + scheduler jobstore + slowapi storage)
redis>=5.0.0
```

> Existing dependencies already pulled in (`fastapi`, `uvicorn[standard]`, `supabase`, `PyJWT`, `pydantic`, `slowapi`, `structlog`, `httpx`) are sufficient for the rest of the implementation.

### 4.2 Frontend — Node packages to add to `prs-neurowellness/package.json`

```json
{
  "dependencies": {
    "socket.io-client": "^4.7.5",
    "@fullcalendar/core": "^6.1.15",
    "@fullcalendar/react": "^6.1.15",
    "@fullcalendar/daygrid": "^6.1.15",
    "@fullcalendar/timegrid": "^6.1.15",
    "@fullcalendar/interaction": "^6.1.15",
    "@fullcalendar/list": "^6.1.15",
    "date-fns": "^3.6.0",
    "date-fns-tz": "^3.1.3"
  }
}
```

> `react-hot-toast`, `@reduxjs/toolkit`, `axios`, `lucide-react`, `tailwindcss` are already installed.

### 4.3 Infrastructure

| Service | Purpose | Notes |
|---------|---------|-------|
| **Redis 7+** | Socket.IO adapter, APScheduler jobstore, slowapi rate-limit storage | Single managed instance (Upstash / AWS ElastiCache / Azure Cache) |
| **Supabase Project** | PostgreSQL DB with RLS | Already provisioned |

### 4.4 Environment variables (new)

**Backend** (`neurowellness/backend/.env`):
```
REDIS_URL=redis://localhost:6379/0
SOCKETIO_CORS_ORIGINS=http://localhost:3000,https://app.neurowellness.com
APPOINTMENT_REMINDER_24H_ENABLED=true
APPOINTMENT_REMINDER_1H_ENABLED=true
APPOINTMENT_DEFAULT_SLOT_MINUTES=30
APPOINTMENT_MAX_BOOKING_DAYS_AHEAD=60
APPOINTMENT_REQUEST_EXPIRY_HOURS=72         # auto-expire pending requests older than this
APP_TIMEZONE=Asia/Kolkata
```

**Frontend** (`prs-neurowellness/.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SOCKET_URL=http://localhost:8000
NEXT_PUBLIC_SOCKET_PATH=/socket.io/
```

---

## 5. Database Schema (Supabase PostgreSQL)

All new tables created in a single migration: `migrations/002_appointment_system.sql`.

### 5.1 Entity-Relationship Overview

```
profiles ──┬── doctor_weekly_schedules  ──┐
           │                                │
           ├── doctor_schedule_overrides ──┤
           │                                │
clinics ───┼──────────────────────────────── appointments ───── appointment_history
           │                                ▲    │
           ├── patients ────────────────────┤    │
           │                                │    │
           │      appointment_requests ─────┘    │   (FK approved_appointment_id)
           │      (parent_appointment_id ────────┘   for reschedule type)
           │
           └── sessions ◄───── appointment_id  (populated when consultation begins)
```

### 5.2 New Tables

#### `doctor_weekly_schedules`
Doctor's recurring weekly template. One row per (doctor, day_of_week, start_time).

```sql
CREATE TABLE doctor_weekly_schedules (
  schedule_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id                UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id                UUID NOT NULL REFERENCES clinics(clinic_id),
  day_of_week              SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sun..6=Sat
  start_time               TIME NOT NULL,
  end_time                 TIME NOT NULL,
  slot_duration_minutes    SMALLINT NOT NULL DEFAULT 30
                           CHECK (slot_duration_minutes IN (15, 20, 30, 45, 60)),
  break_start              TIME,
  break_end                TIME,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from           DATE,
  effective_until          DATE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_times CHECK (end_time > start_time),
  CONSTRAINT chk_break CHECK (
    (break_start IS NULL AND break_end IS NULL)
    OR (break_start IS NOT NULL AND break_end IS NOT NULL
        AND break_start >= start_time AND break_end <= end_time
        AND break_end > break_start)
  ),
  UNIQUE (doctor_id, day_of_week, start_time)
);
CREATE INDEX idx_dws_doctor ON doctor_weekly_schedules(doctor_id, is_active);
CREATE INDEX idx_dws_clinic ON doctor_weekly_schedules(clinic_id);
```

#### `doctor_schedule_overrides`

```sql
CREATE TABLE doctor_schedule_overrides (
  override_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  clinic_id        UUID NOT NULL REFERENCES clinics(clinic_id),
  override_date    DATE NOT NULL,
  is_available     BOOLEAN NOT NULL DEFAULT FALSE,
  start_time       TIME,
  end_time         TIME,
  reason           TEXT,
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_override_times CHECK (
    is_available = FALSE OR (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  ),
  UNIQUE (doctor_id, override_date)
);
CREATE INDEX idx_dso_doctor_date ON doctor_schedule_overrides(doctor_id, override_date);
```

#### `appointments`
Core table — one row per confirmed booking.

```sql
CREATE TABLE appointments (
  appointment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             UUID NOT NULL REFERENCES clinics(clinic_id),
  patient_id            UUID NOT NULL REFERENCES profiles(id),
  doctor_id             UUID NOT NULL REFERENCES profiles(id),
  booked_by             UUID NOT NULL REFERENCES profiles(id),       -- who created the booking
  booked_by_role        TEXT NOT NULL CHECK (booked_by_role IN ('doctor','receptionist','clinical_assistant','admin')),

  -- If this appointment originated from a patient request, FK back to it.
  appointment_request_id UUID REFERENCES appointment_requests(request_id),

  appointment_date      DATE NOT NULL,
  start_time            TIME NOT NULL,
  end_time              TIME NOT NULL,
  start_at              TIMESTAMPTZ NOT NULL,       -- denormalised UTC start (clinic-local → UTC)
  end_at                TIMESTAMPTZ NOT NULL,

  status                TEXT NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled','confirmed','checked_in','in_progress',
                                          'completed','cancelled','no_show','rescheduled')),
  appointment_type      TEXT NOT NULL DEFAULT 'consultation'
                        CHECK (appointment_type IN ('consultation','follow_up','assessment','emergency','video')),

  reason                TEXT,
  notes                 TEXT,                       -- internal staff notes
  patient_complaint     TEXT,                       -- carried over from request when applicable
  cancellation_reason   TEXT,
  cancelled_by          UUID REFERENCES profiles(id),
  cancelled_at          TIMESTAMPTZ,

  rescheduled_from      UUID REFERENCES appointments(appointment_id),
  rescheduled_to        UUID REFERENCES appointments(appointment_id),

  session_id            UUID REFERENCES sessions(id),

  reminder_24h_sent_at  TIMESTAMPTZ,
  reminder_1h_sent_at   TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_apt_times CHECK (end_time > start_time),
  CONSTRAINT chk_apt_status_cancel CHECK (
    (status <> 'cancelled') OR (cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL)
  ),
  -- HARD constraint preventing double-booking the same doctor at the same start time
  CONSTRAINT uq_doctor_slot UNIQUE (doctor_id, appointment_date, start_time)
);

CREATE INDEX idx_apt_doctor_date    ON appointments(doctor_id, appointment_date) WHERE status NOT IN ('cancelled','no_show');
CREATE INDEX idx_apt_patient_date   ON appointments(patient_id, appointment_date);
CREATE INDEX idx_apt_clinic_date    ON appointments(clinic_id, appointment_date);
CREATE INDEX idx_apt_status         ON appointments(status);
CREATE INDEX idx_apt_start_at       ON appointments(start_at);
CREATE INDEX idx_apt_reminder_24h   ON appointments(start_at) WHERE reminder_24h_sent_at IS NULL AND status IN ('scheduled','confirmed');
CREATE INDEX idx_apt_reminder_1h    ON appointments(start_at) WHERE reminder_1h_sent_at  IS NULL AND status IN ('scheduled','confirmed');
CREATE INDEX idx_apt_request        ON appointments(appointment_request_id);
```

#### `appointment_requests` 🆕
Patient-initiated requests that the receptionist must review and assign.

```sql
CREATE TABLE appointment_requests (
  request_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id               UUID NOT NULL REFERENCES clinics(clinic_id),
  patient_id              UUID NOT NULL REFERENCES profiles(id),
  doctor_id               UUID NOT NULL REFERENCES profiles(id),       -- patient's assigned doctor (read from patients.assigned_doctor_id at submit time)

  request_type            TEXT NOT NULL DEFAULT 'new'
                          CHECK (request_type IN ('new','reschedule')),
  parent_appointment_id   UUID REFERENCES appointments(appointment_id), -- required when request_type='reschedule'

  preferred_date_1        DATE NOT NULL,
  preferred_date_2        DATE,
  preferred_date_3        DATE,
  preferred_time_window   TEXT NOT NULL DEFAULT 'any'
                          CHECK (preferred_time_window IN ('morning','afternoon','evening','any')),

  patient_complaint       TEXT NOT NULL,
  reason                  TEXT,
  urgency                 TEXT NOT NULL DEFAULT 'normal'
                          CHECK (urgency IN ('normal','urgent','emergency')),

  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','cancelled_by_patient','expired')),

  -- Resolution
  approved_appointment_id UUID REFERENCES appointments(appointment_id),
  reviewed_by             UUID REFERENCES profiles(id),
  reviewed_at             TIMESTAMPTZ,
  review_notes            TEXT,                                          -- reject reason or notes
  expires_at              TIMESTAMPTZ,                                   -- set by service: created_at + APPOINTMENT_REQUEST_EXPIRY_HOURS

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_reschedule_has_parent CHECK (
    request_type = 'new' OR (request_type = 'reschedule' AND parent_appointment_id IS NOT NULL)
  ),
  CONSTRAINT chk_resolution CHECK (
    (status = 'approved' AND approved_appointment_id IS NOT NULL AND reviewed_by IS NOT NULL)
    OR (status = 'rejected' AND reviewed_by IS NOT NULL AND review_notes IS NOT NULL)
    OR (status IN ('pending','cancelled_by_patient','expired'))
  )
);

CREATE INDEX idx_apt_req_clinic_status   ON appointment_requests(clinic_id, status, created_at DESC);
CREATE INDEX idx_apt_req_patient         ON appointment_requests(patient_id, created_at DESC);
CREATE INDEX idx_apt_req_doctor          ON appointment_requests(doctor_id);
CREATE INDEX idx_apt_req_pending_expiry  ON appointment_requests(expires_at) WHERE status = 'pending';
CREATE INDEX idx_apt_req_parent          ON appointment_requests(parent_appointment_id);
-- A patient may have at most one pending reschedule request per appointment
CREATE UNIQUE INDEX uq_apt_req_one_pending_reschedule
  ON appointment_requests(parent_appointment_id)
  WHERE status = 'pending' AND request_type = 'reschedule';
```

#### `appointment_history`
Append-only audit log for **both** appointments and requests (single table, polymorphic via `entity_type`).

```sql
CREATE TABLE appointment_history (
  history_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type      TEXT NOT NULL CHECK (entity_type IN ('appointment','request')),
  entity_id        UUID NOT NULL,                       -- appointment_id OR request_id
  action           TEXT NOT NULL CHECK (action IN
                   ('created','confirmed','checked_in','started','completed',
                    'cancelled','rescheduled','no_show','notes_updated','status_changed',
                    'request_submitted','request_approved','request_rejected',
                    'request_cancelled_by_patient','request_expired')),
  old_status       TEXT,
  new_status       TEXT,
  changed_by       UUID NOT NULL REFERENCES profiles(id),
  changed_by_role  TEXT NOT NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB DEFAULT '{}'::jsonb,
  notes            TEXT
);
CREATE INDEX idx_apt_hist_entity ON appointment_history(entity_type, entity_id, changed_at DESC);
```

### 5.3 Modified Tables

```sql
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES appointments(appointment_id);
CREATE INDEX idx_sessions_appointment ON sessions(appointment_id);
```

### 5.4 Row-Level Security Policies

```sql
ALTER TABLE appointments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_weekly_schedules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_schedule_overrides  ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_history        ENABLE ROW LEVEL SECURITY;

-- ── appointments ──
CREATE POLICY apt_patient_select ON appointments FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY apt_doctor_select ON appointments FOR SELECT
  USING (auth.uid() = doctor_id);

CREATE POLICY apt_clinic_staff_select ON appointments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('receptionist','clinical_assistant','admin')
      AND p.clinic_id = appointments.clinic_id
  ));

-- ── appointment_requests ──
CREATE POLICY apt_req_patient_select ON appointment_requests FOR SELECT
  USING (auth.uid() = patient_id);

CREATE POLICY apt_req_clinic_staff_select ON appointment_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('receptionist','clinical_assistant','doctor','admin')
      AND p.clinic_id = appointment_requests.clinic_id
  ));

-- ── doctor_weekly_schedules + doctor_schedule_overrides ──
-- NOT exposed to patient role. Backend never returns these via patient endpoints.
CREATE POLICY sched_owner_select ON doctor_weekly_schedules FOR SELECT
  USING (auth.uid() = doctor_id);

CREATE POLICY sched_clinic_staff_select ON doctor_weekly_schedules FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('receptionist','clinical_assistant','admin')
      AND p.clinic_id = doctor_weekly_schedules.clinic_id
  ));

-- (Mirror policies for doctor_schedule_overrides)

-- Insert / update / delete on all of the above:
-- handled exclusively by backend service-role key (bypasses RLS).
-- Frontend never writes these tables directly; everything goes through FastAPI.
```

> **Critical**: Patients have **no SELECT policy** on `doctor_weekly_schedules` or `doctor_schedule_overrides`. Even if a future bug exposes the table to Supabase JS SDK, RLS guarantees patients cannot read the schedule.

---

## 6. Backend Implementation (FastAPI)

### 6.1 New Directory Layout

```
neurowellness/backend/app/
├── main.py                          [MODIFY — wrap with socketio ASGI]
├── config.py                        [MODIFY — add REDIS_URL, SOCKETIO_*, request-expiry vars]
├── socket_io/                       [NEW]
│   ├── __init__.py
│   ├── server.py                    sio = AsyncServer + ASGI wrapper
│   ├── auth.py                      JWT verification on connect
│   ├── events.py                    connect, disconnect, join_room handlers
│   ├── emitter.py                   emit_appointment_event + emit_request_event helpers
│   └── adapter.py                   Redis adapter setup (prod)
├── scheduler/                       [NEW]
│   ├── __init__.py
│   ├── scheduler.py                 APScheduler instance + lifespan hooks
│   └── jobs.py                      reminder dispatcher, request expiry GC, no-show cleanup
├── models/
│   ├── appointment.py               [NEW] Pydantic models for appointments
│   └── appointment_request.py       [NEW] Pydantic models for requests
├── services/
│   ├── appointment_service.py       [NEW] booking, cancel, reschedule logic
│   ├── request_service.py           [NEW] request submit, approve, reject, cancel, expire
│   ├── schedule_service.py          [NEW] slot generation, conflict detection
│   └── notification.py              [MODIFY — emit socket event alongside DB insert]
├── routers/
│   ├── appointments.py              [NEW] /appointments/* endpoints
│   ├── appointment_requests.py      [NEW] /appointment-requests/* endpoints
│   └── doctor_schedule.py           [NEW] /schedule/* endpoints  (staff + doctor only)
└── utils/
    └── timezone.py                  [NEW] clinic-local ↔ UTC helpers
```

### 6.2 Pydantic Models

#### `app/models/appointment.py`

```python
from datetime import date, time, datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict

AppointmentStatus = Literal['scheduled','confirmed','checked_in','in_progress',
                            'completed','cancelled','no_show','rescheduled']
AppointmentType   = Literal['consultation','follow_up','assessment','emergency','video']

class AppointmentCreate(BaseModel):
    """Used by staff roles to create an appointment directly against a slot."""
    patient_id:        str
    doctor_id:         str
    appointment_date:  date
    start_time:        time
    appointment_type:  AppointmentType = 'consultation'
    reason:            Optional[str] = None
    patient_complaint: Optional[str] = None
    appointment_request_id: Optional[str] = None  # populated when created from approving a request

class AppointmentReschedule(BaseModel):
    appointment_date: date
    start_time:       time
    reason:           Optional[str] = None

class AppointmentCancel(BaseModel):
    cancellation_reason: str = Field(..., min_length=3, max_length=500)

class AppointmentUpdate(BaseModel):
    notes:             Optional[str] = None
    patient_complaint: Optional[str] = None
    appointment_type:  Optional[AppointmentType] = None

class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    appointment_id:   str
    clinic_id:        str
    patient_id:       str
    patient_name:     str
    doctor_id:        str
    doctor_name:      str
    appointment_date: date
    start_time:       time
    end_time:         time
    start_at:         datetime
    end_at:           datetime
    status:           AppointmentStatus
    appointment_type: AppointmentType
    reason:           Optional[str]
    notes:            Optional[str]
    patient_complaint: Optional[str]
    booked_by:        str
    booked_by_role:   str
    appointment_request_id: Optional[str]
    rescheduled_from: Optional[str]
    rescheduled_to:   Optional[str]
    created_at:       datetime
    updated_at:       datetime
```

#### `app/models/appointment_request.py`

```python
RequestType   = Literal['new','reschedule']
RequestStatus = Literal['pending','approved','rejected','cancelled_by_patient','expired']
TimeWindow    = Literal['morning','afternoon','evening','any']
Urgency       = Literal['normal','urgent','emergency']

class AppointmentRequestCreate(BaseModel):
    """Used by patient to request a new appointment."""
    preferred_date_1:      date
    preferred_date_2:      Optional[date] = None
    preferred_date_3:      Optional[date] = None
    preferred_time_window: TimeWindow = 'any'
    patient_complaint:     str = Field(..., min_length=5, max_length=2000)
    reason:                Optional[str] = None
    urgency:               Urgency = 'normal'

class RescheduleRequestCreate(BaseModel):
    """Used by patient against an existing appointment."""
    preferred_date_1:      date
    preferred_date_2:      Optional[date] = None
    preferred_date_3:      Optional[date] = None
    preferred_time_window: TimeWindow = 'any'
    reason:                str = Field(..., min_length=5, max_length=500)

class RequestApprove(BaseModel):
    """Receptionist's approval payload — picks the actual slot."""
    appointment_date: date
    start_time:       time
    appointment_type: AppointmentType = 'consultation'
    notes:            Optional[str] = None         # internal note attached to created appointment

class RequestReject(BaseModel):
    review_notes: str = Field(..., min_length=5, max_length=500)

class AppointmentRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    request_id:            str
    clinic_id:             str
    patient_id:            str
    patient_name:          str
    doctor_id:             str
    doctor_name:           str
    request_type:          RequestType
    parent_appointment_id: Optional[str]
    preferred_date_1:      date
    preferred_date_2:      Optional[date]
    preferred_date_3:      Optional[date]
    preferred_time_window: TimeWindow
    patient_complaint:     str
    reason:                Optional[str]
    urgency:               Urgency
    status:                RequestStatus
    approved_appointment_id: Optional[str]
    reviewed_by:           Optional[str]
    reviewer_name:         Optional[str]
    reviewed_at:           Optional[datetime]
    review_notes:          Optional[str]
    expires_at:            Optional[datetime]
    created_at:            datetime
    updated_at:            datetime
```

### 6.3 Service Layer

#### `app/services/schedule_service.py`

Responsibilities:
- Generate available slots for a given doctor and date range.
- Detect conflicts (existing appointment overlapping a candidate slot).
- Apply overrides (full-day off, modified hours).

```python
def generate_slots(
    doctor_id: str, clinic_id: str,
    date_from: date, date_to: date,
    *, include_unavailable: bool = False,
) -> list[SlotOut]: ...

def is_slot_available(doctor_id: str, appointment_date: date, start_time: time) -> bool: ...

def upsert_weekly_schedule(doctor_id: str, clinic_id: str, items: list[WeeklyScheduleItem]) -> None: ...

def add_override(doctor_id: str, clinic_id: str, payload: ScheduleOverrideCreate, created_by: str) -> dict: ...
```

> **All slot-reading endpoints are gated to staff + doctor only.** The router declares `Depends(require_staff_or_doctor)`; patient role receives 403.

#### `app/services/appointment_service.py`

```python
async def create_appointment(
    payload: AppointmentCreate, *, current_user: dict
) -> AppointmentOut:
    """
    Authorisation:
      - current_user.role must be in {doctor, receptionist, clinical_assistant, admin}.
      - Patient role is REJECTED — patients must use request flow.
      - clinic match enforced.

    Procedure:
      1. Compute end_time from doctor's slot_duration_minutes.
      2. Compute start_at / end_at in UTC (clinic timezone).
      3. schedule_service.is_slot_available(...)
      4. INSERT into appointments. DB UNIQUE catches races → 409 Conflict.
      5. INSERT into appointment_history (entity_type='appointment', action='created').
      6. send_notification() → patient + doctor (in-app row).
      7. emit_appointment_event('appointment:created', AppointmentOut, clinic_id, patient_id, doctor_id).
    """

async def cancel_appointment(appointment_id: str, payload: AppointmentCancel, *, current_user: dict) -> AppointmentOut:
    """
    Authorisation:
      - Patient: only if patient_id == current_user.id AND start_at - now >= 2 hours.
      - Doctor: only if doctor_id == current_user.id.
      - Staff: any appointment in their clinic.
    """

async def reschedule_appointment_direct(appointment_id: str, payload: AppointmentReschedule, *, current_user: dict) -> AppointmentOut:
    """
    Authorisation:
      - Patient: REJECTED — patient must use request_service.create_reschedule_request().
      - Doctor / Staff: allowed.

    Behaviour:
      Creates new appointment with rescheduled_from = old_id.
      Updates old appointment status='rescheduled', rescheduled_to = new_id.
      Two history rows. Emits 'appointment:rescheduled'.
    """

async def confirm_appointment(appointment_id: str, *, current_user: dict) -> AppointmentOut: ...
async def check_in_appointment(appointment_id: str, *, current_user: dict) -> AppointmentOut: ...
async def start_appointment(appointment_id: str, *, current_user: dict) -> AppointmentOut: ...
async def complete_appointment(appointment_id: str, *, current_user: dict) -> AppointmentOut:
    """Creates / links the clinical sessions row (session_id back-fill)."""
async def mark_no_show(appointment_id: str, *, current_user: dict) -> AppointmentOut: ...

def list_appointments(
    *, current_user: dict,
    date_from: Optional[date] = None, date_to: Optional[date] = None,
    status: Optional[AppointmentStatus] = None,
    doctor_id: Optional[str] = None, patient_id: Optional[str] = None,
    page: int = 1, page_size: int = 20,
) -> list[AppointmentOut]:
    """Role-scoped: patient => own; doctor => own; clinic staff => entire clinic."""
```

#### `app/services/request_service.py` 🆕

```python
async def create_new_request(payload: AppointmentRequestCreate, *, current_user: dict) -> AppointmentRequestOut:
    """
    Authorisation: current_user.role == 'patient'.

    Procedure:
      1. Look up the patient's assigned doctor (patients.assigned_doctor_id).
         If none assigned → 400 ("Please contact reception — no doctor assigned yet").
      2. Reject if patient has another pending 'new' request → 409.
      3. Compute expires_at = now + APPOINTMENT_REQUEST_EXPIRY_HOURS.
      4. INSERT into appointment_requests (status='pending', request_type='new').
      5. INSERT into appointment_history (entity_type='request', action='request_submitted').
      6. send_notification() → patient (confirmation) AND every receptionist of the clinic.
      7. emit_request_event('appointment_request:created', ..., clinic_id, patient_id).
    """

async def create_reschedule_request(
    appointment_id: str, payload: RescheduleRequestCreate, *, current_user: dict
) -> AppointmentRequestOut:
    """
    Authorisation:
      - current_user.role == 'patient' AND appointment.patient_id == current_user.id.
      - appointment.status in {scheduled, confirmed}.
      - appointment.start_at - now >= 24 hours (configurable).
      - No other pending reschedule request for this appointment (DB unique index).
    """

async def cancel_request(request_id: str, *, current_user: dict) -> AppointmentRequestOut:
    """Patient can withdraw their own pending request. status → 'cancelled_by_patient'."""

async def approve_request(
    request_id: str, payload: RequestApprove, *, current_user: dict
) -> AppointmentRequestOut:
    """
    Authorisation: receptionist / admin in same clinic as request.

    Procedure (all in one transactional flow):
      1. Load request (must be 'pending'). Else 409.
      2. If request_type='new':
            a. appointment_service.create_appointment(
                 AppointmentCreate(
                   patient_id=req.patient_id, doctor_id=req.doctor_id,
                   appointment_date=payload.appointment_date,
                   start_time=payload.start_time,
                   appointment_type=payload.appointment_type,
                   patient_complaint=req.patient_complaint,
                   reason=req.reason,
                   appointment_request_id=req.request_id,
                 ),
                 current_user=current_user,
               )
         If request_type='reschedule':
            a. Create new appointment as above with rescheduled_from = parent_appointment_id.
            b. Update parent appointment status='rescheduled', rescheduled_to=new_id.
      3. UPDATE request SET status='approved', approved_appointment_id=new_apt.id,
                            reviewed_by=current_user.id, reviewed_at=NOW().
      4. INSERT appointment_history (entity_type='request', action='request_approved').
      5. send_notification() → patient ("Your appointment has been confirmed for {date} at {time}").
      6. emit_request_event('appointment_request:approved', ..., clinic_id, patient_id).
         (appointment_service.create_appointment already emits 'appointment:created'.)
    """

async def reject_request(
    request_id: str, payload: RequestReject, *, current_user: dict
) -> AppointmentRequestOut:
    """
    Authorisation: receptionist / admin in same clinic.

    Procedure:
      1. UPDATE request SET status='rejected', reviewed_by=current_user.id,
                            reviewed_at=NOW(), review_notes=payload.review_notes.
      2. INSERT appointment_history.
      3. send_notification() → patient ("Your appointment request was declined. Reason: …").
      4. emit_request_event('appointment_request:rejected', ..., user_id=patient_id).
    """

def list_requests(
    *, current_user: dict,
    status: Optional[RequestStatus] = None,
    page: int = 1, page_size: int = 20,
) -> list[AppointmentRequestOut]:
    """
    Role-scoped:
      - patient: their own requests only.
      - receptionist/clinical_assistant/admin: all requests in their clinic (default filter: status='pending').
      - doctor: requests for their own patients (read-only).
    """
```

### 6.4 Authorisation Matrix (enforced in service layer)

| Action | Patient | Doctor | Receptionist | Clin. Asst. | Admin |
|--------|---------|--------|--------------|-------------|-------|
| **View doctor schedule / slots** | ❌ | ✅ own | ✅ | ✅ | ✅ |
| **Create appointment directly** (against a known slot) | ❌ | ✅ for own slots | ✅ any doctor in clinic | ✅ any doctor in clinic | ✅ |
| **Submit appointment request** (preferred dates only) | ✅ for own assigned doctor | ❌ | ❌ | ❌ | ❌ |
| **View own requests** | ✅ | — | ✅ all clinic | ✅ all clinic | ✅ |
| **Approve / reject request** | ❌ | ❌ | ✅ | ❌ | ✅ |
| **Cancel own pending request** | ✅ | — | — | — | — |
| **Cancel appointment** | ✅ own, ≥ 2 h before | ✅ own | ✅ any in clinic | ✅ any in clinic | ✅ |
| **Reschedule appointment directly** | ❌ | ✅ own | ✅ any in clinic | ✅ any in clinic | ✅ |
| **Submit reschedule request** | ✅ own, ≥ 24 h before | — | — | — | — |
| **Confirm / Check-in / Start / Complete** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Edit notes** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Manage weekly schedule** | ❌ | ✅ own | ❌ | ❌ | ✅ |
| **Add schedule override** | ❌ | ✅ own | ✅ on behalf | ❌ | ✅ |

### 6.5 Modified `app/main.py`

```python
from contextlib import asynccontextmanager
from app.socket_io.server import sio, mount_socketio
from app.scheduler.scheduler import start_scheduler, shutdown_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()

app = FastAPI(
    title="NeuroWellness API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
)

# ... existing middleware ...
# ... existing routers ...
app.include_router(appointments.router,         prefix="/api/v1/appointments",         tags=["appointments"])
app.include_router(appointment_requests.router, prefix="/api/v1/appointment-requests", tags=["appointment-requests"])
app.include_router(doctor_schedule.router,      prefix="/api/v1/schedule",             tags=["schedule"])

asgi_app = mount_socketio(app)   # socketio.ASGIApp(sio, app, socketio_path="socket.io")
```

> **Launch command change** — `uvicorn app.main:asgi_app` (was `app.main:app`). Update `Dockerfile`, `Makefile`, and any deployment manifests accordingly.

---

## 7. Real-Time Layer — Socket.IO Integration

### 7.1 Server setup, auth, events
Identical to V1 of this document (`socket_io/server.py`, `auth.py`, `events.py`) — JWT verified via the existing `_decode_token()`; rooms are `user:{id}`, `doctor:{id}`, `clinic:{id}`, `role:{role}`.

### 7.2 Emitter — `app/socket_io/emitter.py`

```python
async def emit_appointment_event(event, payload, *, clinic_id, patient_id, doctor_id):
    await sio.emit(event, payload, room=f"user:{patient_id}")
    await sio.emit(event, payload, room=f"doctor:{doctor_id}")
    await sio.emit(event, payload, room=f"clinic:{clinic_id}")

async def emit_request_event(event, payload, *, clinic_id, patient_id):
    # Patients get their own request lifecycle updates; clinic staff sees the inbox update.
    await sio.emit(event, payload, room=f"user:{patient_id}")
    await sio.emit(event, payload, room=f"clinic:{clinic_id}")
```

### 7.3 Complete Event Catalogue

| Event name | Payload (TS-style) | Receivers | Trigger |
|------------|--------------------|-----------|---------|
| `appointment:created` | `{ appointment: AppointmentOut }` | patient, doctor, clinic-staff | direct booking or request approval |
| `appointment:confirmed` | `{ appointment_id, confirmed_by, confirmed_at }` | patient, doctor, clinic-staff | staff confirms |
| `appointment:checked_in` | `{ appointment_id, checked_in_at }` | doctor, clinic-staff | front-desk check-in |
| `appointment:completed` | `{ appointment_id, session_id? }` | patient, doctor, clinic-staff | doctor marks complete |
| `appointment:cancelled` | `{ appointment_id, cancelled_by, cancelled_by_role, reason }` | patient, doctor, clinic-staff | patient/staff cancel |
| `appointment:rescheduled` | `{ old_appointment_id, new_appointment: AppointmentOut }` | patient, doctor, clinic-staff | doctor/staff direct reschedule OR request approval |
| `appointment:no_show` | `{ appointment_id, flagged_by }` | patient, doctor, clinic-staff | manual or scheduler |
| `appointment:updated` | `{ appointment_id, changes }` | patient, doctor, clinic-staff | notes / type edits |
| `appointment:reminder` | `{ appointment, lead_time: '24h' \| '1h' }` | patient + doctor (private rooms) | scheduler |
| `appointment_request:created` 🆕 | `{ request: AppointmentRequestOut }` | patient, clinic-staff | patient submits new or reschedule request |
| `appointment_request:approved` 🆕 | `{ request: AppointmentRequestOut, appointment: AppointmentOut }` | patient, clinic-staff | receptionist approves |
| `appointment_request:rejected` 🆕 | `{ request: AppointmentRequestOut }` | patient | receptionist rejects |
| `appointment_request:cancelled_by_patient` 🆕 | `{ request_id }` | clinic-staff | patient withdraws |
| `appointment_request:expired` 🆕 | `{ request_id }` | patient, clinic-staff | scheduler GC |
| `notification:new` | `{ notification }` | private user room | any notification persisted |

---

## 8. Background Jobs & Reminders

### 8.1 Scheduler — `app/scheduler/scheduler.py`
Same as V1 of this document (AsyncIOScheduler, Redis jobstore in prod, configured via `RUN_SCHEDULER` env gate).

### 8.2 `app/scheduler/jobs.py`

```python
async def dispatch_reminders():
    """Every 5 minutes — 24h and 1h reminders."""
    # ... same as V1 ...

async def expire_stale_requests():
    """Every 30 minutes — flip pending requests past expires_at to status='expired',
       emit appointment_request:expired."""

async def cleanup_no_shows():
    """Daily 2 AM — flip 'scheduled'/'confirmed' rows whose end_at is more than 2h ago to 'no_show'."""

def register_jobs(sched):
    sched.add_job(dispatch_reminders,     trigger="interval", minutes=5,  id="reminder_dispatcher",   replace_existing=True, coalesce=True, max_instances=1)
    sched.add_job(expire_stale_requests,  trigger="interval", minutes=30, id="request_expiry_gc",     replace_existing=True, coalesce=True, max_instances=1)
    sched.add_job(cleanup_no_shows,       trigger="cron",     hour=2, minute=0, id="no_show_cleanup", replace_existing=True)
```

### 8.3 RPC functions on Supabase

- `appointments_due_for_reminder(window_start, window_end, lead_time)` — atomically selects and marks reminder columns to prevent double-send.
- `expire_pending_requests()` — atomically flips expired rows and returns them so the scheduler can emit events.

---

## 9. REST API Specification

All endpoints under `/api/v1`. All responses use the existing `success_response()` / `paginated_response()` envelope.

### 9.1 Doctor Schedule (`/schedule`) — **staff + doctor only, never patient**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/schedule/my` | doctor | My weekly schedule + upcoming overrides |
| GET | `/schedule/doctor/{doctor_id}` | staff or doctor | Doctor's weekly schedule (used by receptionist when approving requests) |
| PUT | `/schedule/my` | doctor | Replace my weekly schedule (atomic) |
| POST | `/schedule/my/overrides` | doctor | Add date override |
| DELETE | `/schedule/my/overrides/{override_id}` | doctor | Remove override |
| GET | `/schedule/doctor/{doctor_id}/slots` | staff or doctor | List slots (query: `from_date`, `to_date`, `include_unavailable`) |
| GET | `/schedule/clinic/doctors` | staff | List doctors in my clinic with availability summary |

> **Every route here uses `Depends(require_staff_or_doctor)`. Patient role gets 403.** Patient UI never imports `schedule.service.ts`.

### 9.2 Appointments (`/appointments`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/appointments` | doctor / staff (NOT patient) | Direct create appointment |
| GET | `/appointments` | any auth | Role-scoped list |
| GET | `/appointments/upcoming` | any auth | My upcoming (14 days) |
| GET | `/appointments/today` | doctor / staff | Today's clinic appointments |
| GET | `/appointments/{id}` | any auth | Single (role-gated) |
| PATCH | `/appointments/{id}` | doctor / staff | Update notes / type / complaint |
| POST | `/appointments/{id}/confirm` | doctor / staff | Confirm |
| POST | `/appointments/{id}/check-in` | doctor / staff | Check-in |
| POST | `/appointments/{id}/start` | doctor | Start consultation (links to session) |
| POST | `/appointments/{id}/complete` | doctor | Complete |
| POST | `/appointments/{id}/cancel` | patient (own ≥ 2 h) or doctor / staff | Cancel |
| POST | `/appointments/{id}/reschedule` | doctor / staff (NOT patient) | Direct reschedule |
| POST | `/appointments/{id}/request-reschedule` 🆕 | patient (own ≥ 24 h) | Submit reschedule request |
| POST | `/appointments/{id}/no-show` | doctor / staff | Mark no-show |
| GET | `/appointments/{id}/history` | any auth | Audit log |

### 9.3 Appointment Requests (`/appointment-requests`) 🆕

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/appointment-requests` | patient | Create a new-appointment request |
| GET | `/appointment-requests` | any auth | Role-scoped list (default status filter for staff = `pending`) |
| GET | `/appointment-requests/{id}` | any auth | Single (role-gated) |
| POST | `/appointment-requests/{id}/cancel` | patient (own) | Withdraw pending request |
| POST | `/appointment-requests/{id}/approve` | receptionist / admin | Approve and assign actual slot |
| POST | `/appointment-requests/{id}/reject` | receptionist / admin | Reject with reason |
| GET | `/appointment-requests/{id}/history` | any auth | Audit log |

### 9.4 Rate Limits (via existing `slowapi`)

| Endpoint group | Limit |
|----------------|-------|
| `POST /appointments` | 10/min per user |
| `POST /appointment-requests` | 5/min per user |
| `POST /appointments/*/cancel` | 10/min per user |
| `POST /appointments/*/request-reschedule` | 5/min per user |
| `POST /appointment-requests/*/approve` | 30/min per user |
| `GET /appointments*` | 120/min per user |
| `GET /schedule/*/slots` | 60/min per user |

---

## 10. Frontend Implementation (Next.js 14)

### 10.1 File map

```
prs-neurowellness/src/
├── app/
│   ├── layout.tsx                              [MODIFY — add <SocketProvider> + <Toaster />]
│   └── (roles)/
│       ├── patient/
│       │   ├── dashboard/page.tsx              [MODIFY — wire "Request Appointment" button]
│       │   └── appointments/                   [NEW]
│       │       ├── page.tsx                    Upcoming / Past + Requests tabs
│       │       ├── request/page.tsx            Submit new-appointment request (NO slot picker)
│       │       └── [id]/page.tsx               Detail + Cancel + Request Reschedule
│       ├── doctor/
│       │   ├── appointments/                   [NEW]
│       │   │   ├── page.tsx                    FullCalendar week view
│       │   │   └── [id]/page.tsx               Detail + actions
│       │   └── schedule/                       [NEW]
│       │       └── page.tsx                    Weekly schedule + overrides
│       ├── receptionist/
│       │   ├── appointments/                   [NEW]
│       │   │   ├── page.tsx                    Calendar / list of clinic appointments
│       │   │   ├── book/page.tsx               Direct-booking wizard (against actual slots)
│       │   │   └── [id]/page.tsx               Detail + actions
│       │   └── appointment-requests/           [NEW]
│       │       ├── page.tsx                    Inbox of pending requests
│       │       └── [id]/page.tsx               Review + Approve (slot picker) / Reject
│       └── clinical-assistant/
│           └── appointments/                   [NEW]
│               └── page.tsx                    Read-only list/calendar
├── components/
│   ├── providers/
│   │   └── SocketProvider.tsx                  [NEW]
│   ├── layout/Sidebar.tsx                      [MODIFY — see §10.6]
│   └── appointments/                           [NEW DIR]
│       ├── AppointmentCalendar.tsx             FullCalendar wrapper (staff/doctor only)
│       ├── AppointmentCard.tsx                 patient + staff list card
│       ├── AppointmentStatusBadge.tsx
│       ├── AppointmentDetailDrawer.tsx
│       ├── BookingWizard.tsx                   staff-only (patient → doctor → date → slot → confirm)
│       ├── PatientPicker.tsx                   staff-only
│       ├── DoctorPicker.tsx                    staff-only
│       ├── DatePickerInline.tsx                staff-only — uses slots API
│       ├── TimeSlotGrid.tsx                    staff-only — uses slots API
│       ├── RescheduleModal.tsx                 staff-only direct reschedule
│       ├── CancelDialog.tsx                    used by patient + staff
│       ├── WeeklyScheduleEditor.tsx            doctor schedule page
│       │
│       ├── PatientRequestForm.tsx              🆕 patient — preferred dates + time window + complaint (NO slot grid)
│       ├── PatientRescheduleRequestForm.tsx    🆕 patient — submit reschedule request
│       ├── RequestCard.tsx                     🆕 list card with status badge
│       ├── RequestReviewPanel.tsx              🆕 receptionist — patient details + preferred dates + slot picker for chosen date + Approve/Reject buttons
│       └── RequestStatusBadge.tsx              🆕
├── lib/
│   ├── socket/
│   │   ├── client.ts                           [NEW] singleton Socket.IO factory
│   │   └── events.ts                           [NEW] typed event names + payload shapes
│   ├── hooks/
│   │   ├── useSocket.ts                        [NEW]
│   │   ├── useAppointments.ts                  [NEW]
│   │   ├── useAvailableSlots.ts                [NEW] — staff/doctor only
│   │   ├── useDoctorSchedule.ts                [NEW]
│   │   ├── useAppointmentRequests.ts           🆕
│   │   └── useMyAppointmentRequests.ts         🆕 patient-scoped
│   ├── api/
│   │   ├── endpoints.ts                        [MODIFY] APPOINTMENTS, SCHEDULE, APPOINTMENT_REQUESTS groups
│   │   └── services/
│   │       ├── appointments.service.ts         [NEW]
│   │       ├── schedule.service.ts             [NEW] — staff/doctor calls only
│   │       └── appointmentRequests.service.ts  🆕
│   ├── constants/index.ts                      [MODIFY] APPOINTMENT_STATUS, REQUEST_STATUS, APPOINTMENT_ROUTES
│   └── utils/datetime.ts                       [NEW]
├── store/
│   ├── store.ts                                [MODIFY — register slices]
│   └── slices/
│       ├── appointmentsSlice.ts                [NEW]
│       ├── appointmentRequestsSlice.ts         🆕
│       └── doctorScheduleSlice.ts              [NEW]
└── types/
    ├── appointment.types.ts                    [NEW]
    └── appointmentRequest.types.ts             🆕
```

### 10.2 Patient request form (no slot picker)

`src/components/appointments/PatientRequestForm.tsx`:

```tsx
"use client";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAppDispatch } from "@/store/hooks";
import { submitAppointmentRequest } from "@/store/slices/appointmentRequestsSlice";
import toast from "react-hot-toast";
import { addDays, format } from "date-fns";

const schema = z.object({
  preferred_date_1: z.string().min(1, "Required"),
  preferred_date_2: z.string().optional(),
  preferred_date_3: z.string().optional(),
  preferred_time_window: z.enum(["morning","afternoon","evening","any"]),
  patient_complaint: z.string().min(5, "Please describe your concern (at least 5 chars)").max(2000),
  urgency: z.enum(["normal","urgent","emergency"]),
  reason: z.string().optional(),
});

export function PatientRequestForm() {
  const dispatch = useAppDispatch();
  const today = format(new Date(), "yyyy-MM-dd");
  const max   = format(addDays(new Date(), 60), "yyyy-MM-dd");

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(schema), defaultValues: {
      preferred_time_window: "any", urgency: "normal",
    }});

  const onSubmit = async (data: any) => {
    try {
      await dispatch(submitAppointmentRequest(data)).unwrap();
      toast.success("Your appointment request has been submitted. The reception team will get back shortly.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit request");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label>Preferred date 1
          <input type="date" min={today} max={max} {...register("preferred_date_1")}
                 className="input" />
          {errors.preferred_date_1 && <p className="text-danger-700 text-xs">{errors.preferred_date_1.message}</p>}
        </label>
        <label>Preferred date 2 (optional)
          <input type="date" min={today} max={max} {...register("preferred_date_2")} className="input" />
        </label>
        <label>Preferred date 3 (optional)
          <input type="date" min={today} max={max} {...register("preferred_date_3")} className="input" />
        </label>
      </div>

      <label>Preferred time window
        <select {...register("preferred_time_window")} className="input">
          <option value="any">Any time</option>
          <option value="morning">Morning (8am–12pm)</option>
          <option value="afternoon">Afternoon (12pm–5pm)</option>
          <option value="evening">Evening (5pm–9pm)</option>
        </select>
      </label>

      <label>Reason / complaint (visible to your doctor)
        <textarea {...register("patient_complaint")} rows={4} className="input" />
        {errors.patient_complaint && <p className="text-danger-700 text-xs">{errors.patient_complaint.message}</p>}
      </label>

      <label>Urgency
        <select {...register("urgency")} className="input">
          <option value="normal">Normal</option>
          <option value="urgent">Urgent</option>
          <option value="emergency">Emergency</option>
        </select>
      </label>

      <button type="submit" disabled={isSubmitting}
              className="btn-primary">{isSubmitting ? "Submitting…" : "Submit request"}</button>

      <p className="text-xs text-neutral-500">
        The reception team will review your request and confirm a time slot with your doctor.
        You will be notified as soon as your appointment is confirmed.
      </p>
    </form>
  );
}
```

### 10.3 Receptionist request-review panel

`src/components/appointments/RequestReviewPanel.tsx`:

```tsx
"use client";
import { useState } from "react";
import { useAvailableSlots } from "@/lib/hooks/useAvailableSlots";
import { useAppointmentRequests } from "@/lib/hooks/useAppointmentRequests";
import toast from "react-hot-toast";

export function RequestReviewPanel({ request }: { request: AppointmentRequest }) {
  const [chosenDate, setChosenDate] = useState<string>(request.preferred_date_1);
  const [chosenTime, setChosenTime] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const { slots, isLoading } = useAvailableSlots(request.doctor_id, chosenDate, chosenDate);
  const { approve, reject } = useAppointmentRequests();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Patient context */}
      <section className="card">
        <h3>Patient: {request.patient_name}</h3>
        <p><b>Urgency:</b> <span className={`badge-${request.urgency}`}>{request.urgency}</span></p>
        <p><b>Reason / complaint:</b> {request.patient_complaint}</p>
        <p><b>Preferred dates:</b> {[request.preferred_date_1, request.preferred_date_2, request.preferred_date_3].filter(Boolean).join(", ")}</p>
        <p><b>Preferred time window:</b> {request.preferred_time_window}</p>
        <p className="text-xs text-neutral-500">Submitted {new Date(request.created_at).toLocaleString()}</p>
      </section>

      {/* RIGHT: Slot picker */}
      <section className="card">
        <h3>Assign slot from Dr. {request.doctor_name}'s schedule</h3>

        <label>Pick a date
          <select value={chosenDate} onChange={e => setChosenDate(e.target.value)}>
            {[request.preferred_date_1, request.preferred_date_2, request.preferred_date_3]
              .filter(Boolean).map(d => <option key={d!} value={d!}>{d}</option>)}
            <option value="">Custom date…</option>
          </select>
          {chosenDate === "" && <input type="date" onChange={e => setChosenDate(e.target.value)} />}
        </label>

        <div className="mt-4">
          <h4>Available slots on {chosenDate}</h4>
          {isLoading && <p>Loading…</p>}
          <div className="grid grid-cols-3 gap-2 mt-2">
            {slots.filter(s => s.is_available).map(s => (
              <button key={s.start_time}
                      className={`slot-btn ${chosenTime === s.start_time ? "active" : ""}`}
                      onClick={() => setChosenTime(s.start_time)}>
                {s.start_time.slice(0,5)}
              </button>
            ))}
            {!isLoading && slots.filter(s => s.is_available).length === 0 &&
              <p className="col-span-3 text-neutral-500">No slots available on this date.</p>}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button disabled={!chosenTime}
                  onClick={async () => {
                    try {
                      await approve(request.request_id, {
                        appointment_date: chosenDate, start_time: chosenTime!,
                      });
                      toast.success(`Appointment confirmed for ${chosenDate} at ${chosenTime}`);
                    } catch (e: any) { toast.error(e.message); }
                  }}
                  className="btn-primary">Approve & assign slot</button>

          <details>
            <summary className="btn-danger cursor-pointer">Reject…</summary>
            <textarea placeholder="Reason for rejection (will be shown to patient)"
                      value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} />
            <button disabled={rejectReason.length < 5}
                    onClick={async () => {
                      await reject(request.request_id, rejectReason);
                      toast("Request rejected", { icon: "❌" });
                    }}
                    className="btn-danger">Confirm reject</button>
          </details>
        </div>
      </section>
    </div>
  );
}
```

### 10.4 Patient appointments page (cancel + request reschedule)

Key UI elements in `/patient/appointments/[id]/page.tsx`:

```tsx
const canCancel       = isPatient && diffHours(appointment.start_at, now) >= 2 && ['scheduled','confirmed'].includes(appointment.status);
const canRequestReschedule = isPatient && diffHours(appointment.start_at, now) >= 24 && ['scheduled','confirmed'].includes(appointment.status);

return (
  <>
    <AppointmentDetailHeader appointment={appointment} />
    <div className="flex gap-2 mt-4">
      {canCancel && <button onClick={openCancelDialog} className="btn-danger">Cancel</button>}
      {canRequestReschedule && <button onClick={openRescheduleDialog} className="btn-secondary">Request reschedule</button>}
    </div>
    {/* …existing appointment detail UI… */}
  </>
);
```

The reschedule dialog uses `PatientRescheduleRequestForm` (preferred dates + time window + reason), not a slot picker.

### 10.5 Socket Provider (additions for request events)

Inside `SocketProvider.tsx`, extend the event handlers:

```tsx
s.on("appointment_request:created", (p) => {
  dispatch(handleRequestSocketEvent({ type: "created", payload: p }));
  if (user?.roles?.includes("receptionist") || user?.roles?.includes("admin")) {
    toast(`New appointment request from ${p.request.patient_name}`, { icon: "📥" });
  }
});
s.on("appointment_request:approved", (p) => {
  dispatch(handleRequestSocketEvent({ type: "approved", payload: p }));
  // Patient also receives appointment:created which already triggers a toast — avoid duplicate.
  if (user?.id === p.request.patient_id) {
    toast.success(`Your appointment is confirmed for ${p.appointment.appointment_date} at ${p.appointment.start_time}`);
  }
});
s.on("appointment_request:rejected", (p) => {
  dispatch(handleRequestSocketEvent({ type: "rejected", payload: p }));
  if (user?.id === p.request.patient_id) {
    toast(`Your appointment request was declined`, { icon: "❌", duration: 7000 });
  }
});
s.on("appointment_request:cancelled_by_patient", (p) => {
  dispatch(handleRequestSocketEvent({ type: "cancelled_by_patient", payload: p }));
});
s.on("appointment_request:expired", (p) => {
  dispatch(handleRequestSocketEvent({ type: "expired", payload: p }));
});
```

### 10.6 Sidebar updates — `src/components/layout/Sidebar.tsx`

```tsx
const NAV_ITEMS = {
  patient: [
    { label: "Dashboard",         href: "/patient/dashboard",                icon: LayoutDashboard },
    { label: "My Appointments",   href: "/patient/appointments",             icon: Calendar    },
    { label: "Request Appointment", href: "/patient/appointments/request",   icon: PlusCircle  },
    { label: "My Results",        href: "/patient/results",                  icon: ClipboardList },
    { label: "Profile",           href: "/patient/profile",                  icon: UserCircle  },
  ],
  doctor: [
    { label: "Dashboard",   href: "/doctor/dashboard",   icon: LayoutDashboard },
    { label: "Appointments", href: "/doctor/appointments", icon: Calendar       },
    { label: "My Schedule",  href: "/doctor/schedule",     icon: CalendarClock  },
    { label: "Patients",     href: "/doctor/patients",     icon: Users          },
    { label: "Alerts",       href: "/doctor/alerts",       icon: AlertCircle    },
  ],
  receptionist: [
    { label: "Dashboard",     href: "/receptionist/dashboard",            icon: LayoutDashboard },
    { label: "Appointments",  href: "/receptionist/appointments",         icon: Calendar      },
    { label: "Requests",      href: "/receptionist/appointment-requests", icon: Inbox         },
    { label: "All Patients",  href: "/receptionist/patients",             icon: Users         },
    { label: "Approvals",     href: "/receptionist/approvals",            icon: ClipboardCheck },
    { label: "Profile",       href: "/receptionist/profile",              icon: UserCircle    },
  ],
  clinical_assistant: [
    { label: "Dashboard",     href: "/clinical-assistant/dashboard",      icon: LayoutDashboard },
    { label: "Appointments",  href: "/clinical-assistant/appointments",   icon: Calendar      },
    { label: "Patients",      href: "/clinical-assistant/patients",       icon: Users         },
  ],
};
```

> The receptionist "Requests" link displays a **badge with the number of pending requests in the clinic** (pulled from Redux). The badge updates live via the `appointment_request:created` socket event.

### 10.7 Redux

#### `appointmentsSlice.ts`
Same as V1 of this document (thunks: `fetchAppointments`, `fetchUpcoming`, `fetchToday`, `fetchAppointmentById`, `bookAppointment`, `cancelAppointment`, `rescheduleAppointment` (staff), `confirmAppointment`, etc.).

#### `appointmentRequestsSlice.ts` 🆕

```typescript
interface AppointmentRequestsState {
  myRequests:     AppointmentRequest[];    // patient view
  clinicRequests: AppointmentRequest[];    // staff view (default filter: status='pending')
  detail:         Record<string, AppointmentRequest>;
  pendingCount:   number;                  // for sidebar badge
  status:         LoadStatus;
  error:          string | null;
  filters:        RequestFilters;
}

// Async thunks
export const fetchMyRequests        = createAsyncThunk(...);
export const fetchClinicRequests    = createAsyncThunk(...);
export const fetchRequestById       = createAsyncThunk(...);
export const submitAppointmentRequest = createAsyncThunk(...);
export const submitRescheduleRequest  = createAsyncThunk(...);
export const cancelMyRequest        = createAsyncThunk(...);
export const approveRequest         = createAsyncThunk(...);   // staff
export const rejectRequest          = createAsyncThunk(...);   // staff

// Socket-driven reducer
handleRequestSocketEvent(state, action) {
  // Upserts into clinicRequests and myRequests as appropriate; bumps pendingCount.
}
```

### 10.8 API endpoints — `src/lib/api/endpoints.ts`

```typescript
export const API_ENDPOINTS = {
  // ... existing entries ...

  APPOINTMENTS: {
    LIST:        "/appointments",
    UPCOMING:    "/appointments/upcoming",
    TODAY:       "/appointments/today",
    CREATE:      "/appointments",
    DETAIL:      (id: string) => `/appointments/${id}`,
    HISTORY:     (id: string) => `/appointments/${id}/history`,
    CONFIRM:     (id: string) => `/appointments/${id}/confirm`,
    CHECK_IN:    (id: string) => `/appointments/${id}/check-in`,
    START:       (id: string) => `/appointments/${id}/start`,
    COMPLETE:    (id: string) => `/appointments/${id}/complete`,
    CANCEL:      (id: string) => `/appointments/${id}/cancel`,
    RESCHEDULE:  (id: string) => `/appointments/${id}/reschedule`,                // staff/doctor
    REQUEST_RESCHEDULE: (id: string) => `/appointments/${id}/request-reschedule`, // patient 🆕
    NO_SHOW:     (id: string) => `/appointments/${id}/no-show`,
  },

  APPOINTMENT_REQUESTS: {
    LIST:    "/appointment-requests",
    CREATE:  "/appointment-requests",
    DETAIL:  (id: string) => `/appointment-requests/${id}`,
    CANCEL:  (id: string) => `/appointment-requests/${id}/cancel`,
    APPROVE: (id: string) => `/appointment-requests/${id}/approve`,
    REJECT:  (id: string) => `/appointment-requests/${id}/reject`,
    HISTORY: (id: string) => `/appointment-requests/${id}/history`,
  },

  SCHEDULE: {
    MY:               "/schedule/my",
    UPSERT:           "/schedule/my",
    OVERRIDES:        "/schedule/my/overrides",
    OVERRIDE:         (id: string) => `/schedule/my/overrides/${id}`,
    DOCTOR:           (doctorId: string) => `/schedule/doctor/${doctorId}`,
    SLOTS:            (doctorId: string) => `/schedule/doctor/${doctorId}/slots`,
    CLINIC_DOCTORS:   "/schedule/clinic/doctors",
  },
};
```

### 10.9 TypeScript types — `src/types/appointmentRequest.types.ts`

```typescript
export type RequestType   = "new" | "reschedule";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled_by_patient" | "expired";
export type TimeWindow    = "morning" | "afternoon" | "evening" | "any";
export type Urgency       = "normal" | "urgent" | "emergency";

export interface AppointmentRequest {
  request_id:              string;
  clinic_id:               string;
  patient_id:              string;
  patient_name:            string;
  doctor_id:               string;
  doctor_name:             string;
  request_type:            RequestType;
  parent_appointment_id?:  string;
  preferred_date_1:        string;
  preferred_date_2?:       string;
  preferred_date_3?:       string;
  preferred_time_window:   TimeWindow;
  patient_complaint:       string;
  reason?:                 string;
  urgency:                 Urgency;
  status:                  RequestStatus;
  approved_appointment_id?: string;
  reviewed_by?:            string;
  reviewer_name?:          string;
  reviewed_at?:            string;
  review_notes?:           string;
  expires_at?:             string;
  created_at:              string;
  updated_at:              string;
}
```

---

## 11. Calendar Integration

FullCalendar is used **only in staff-facing and doctor-facing pages** (`/doctor/appointments`, `/receptionist/appointments`, `/clinical-assistant/appointments`).

- **Patient pages never render FullCalendar** and never call `/schedule/*` endpoints — the bundle splitting in Next.js means FullCalendar is not loaded on patient routes.
- Per-role view config:

| Role | Default view | Editable | Filters |
|------|--------------|----------|---------|
| Doctor | `timeGridWeek` | ✅ (drag-drop reschedule) | Status |
| Receptionist | `dayGridMonth` (toggle to week / day / list) | ✅ | Doctor, status, date range |
| Clinical Asst. | `timeGridWeek` | ❌ | Doctor, status |
| Patient | (no calendar — uses simple card list with tabs) | ❌ | Status (Upcoming / Past / Requests) |

The FullCalendar wrapper, status colours, and drag-drop reschedule code are identical to the previous version of this document.

---

## 12. Notification & Toast System

### 12.1 Three layers
1. **DB row** in `notifications` (persisted).
2. **Socket event** `notification:new` — pushed to `user:{id}` room; bell icon counter updates immediately.
3. **Toast** — `react-hot-toast` rendered by `SocketProvider`.

### 12.2 Notification types

| Type | Recipient(s) | Trigger |
|------|--------------|---------|
| `appointment_request_submitted` | patient (confirmation), all clinic receptionists | Patient submits request |
| `appointment_request_approved` | patient | Receptionist approves |
| `appointment_request_rejected` | patient | Receptionist rejects |
| `appointment_request_cancelled_by_patient` | clinic receptionists | Patient withdraws |
| `appointment_request_expired` | patient, clinic receptionists | Scheduler GC |
| `reschedule_request_submitted` | patient (confirmation), receptionists | Patient submits reschedule request |
| `reschedule_request_approved` | patient | Receptionist approves new slot |
| `reschedule_request_rejected` | patient | Receptionist rejects |
| `appointment_created` | patient, doctor | Direct booking |
| `appointment_confirmed` | patient | Doctor / staff confirms |
| `appointment_cancelled` | the other party (patient or doctor) | Cancellation |
| `appointment_rescheduled` | patient, doctor | Reschedule (any source) |
| `appointment_reminder_24h` | patient, doctor | 24h scheduler job |
| `appointment_reminder_1h` | patient, doctor | 1h scheduler job |
| `appointment_no_show` | patient, doctor | No-show flagged |
| `appointment_completed` | patient | Doctor marks complete |

---

## 13. Multi-Tenancy (Clinic Scoping)

1. `current_user.clinic_id` is loaded at JWT validation (existing `dependencies.py`).
2. Every appointment AND appointment-request write must set `clinic_id = current_user.clinic_id`.
3. Every read filtered server-side; Supabase RLS provides defence-in-depth.
4. Slot generation only includes doctors with matching `clinic_id`.
5. Socket rooms are clinic-prefixed: receptionist X in clinic A never receives clinic B events.
6. **A patient's request can only target their assigned doctor**, which is in the same clinic as the patient by construction.

---

## 14. Role-Based Workflows

### 14.1 Receptionist — Direct Booking (walk-in or phone)

```
1. /receptionist/appointments → "Book Appointment" button
2. Wizard step 1: Search existing patient (name / phone / MRN) OR "Register New Patient"
   → uses existing POST /api/v1/staff/patients/register
3. Step 2: Select doctor (clinic-scoped dropdown)
4. Step 3: Date picker — only days where doctor has free slots
5. Step 4: Time-slot grid for chosen date
6. Step 5: Reason, appointment type → submit
7. POST /api/v1/appointments → success toast
8. Socket event 'appointment:created' fires → patient (if online) sees toast; doctor calendar updates
```

### 14.2 Receptionist — Review Patient Request

```
1. Sidebar badge shows N pending requests
2. /receptionist/appointment-requests — inbox with filters (urgency, doctor, date submitted)
3. Click row → /receptionist/appointment-requests/{id} (RequestReviewPanel)
4. Left panel: patient complaint, preferred dates, urgency
5. Right panel: pick a preferred date OR custom date; slot grid loads from
   GET /api/v1/schedule/doctor/{doctor_id}/slots?from_date=X&to_date=X
6. Click a slot → "Approve & assign slot"
7. POST /api/v1/appointment-requests/{id}/approve
8. Two socket events fan out: 'appointment:created' + 'appointment_request:approved'
9. Patient receives toast "Your appointment is confirmed for {date} at {time}"
```

If rejecting:
```
1. Open "Reject…" panel, enter reason ≥ 5 chars
2. POST /api/v1/appointment-requests/{id}/reject
3. Patient receives toast + notification with reason
```

### 14.3 Doctor — Manage Calendar

```
1. /doctor/appointments — FullCalendar week view
2. Click event → drawer with Confirm / Check-in / Start / Complete / Cancel / Reschedule
3. Drag-drop event to new time → POST .../reschedule (direct, not via request)
4. Click empty slot → "Block this slot" (creates a 'emergency' self-booked block)
5. /doctor/schedule — set weekly hours + add overrides
```

### 14.4 Patient — Request Appointment

```
1. /patient/dashboard → "Request Appointment" button
2. /patient/appointments/request — PatientRequestForm
   (preferred date 1 + optional 2,3 + time window + complaint + urgency)
3. Submit → POST /api/v1/appointment-requests
4. Confirmation toast: "Your appointment request has been submitted. The reception team will get back shortly."
5. Patient is taken to /patient/appointments?tab=requests showing the pending request
6. When receptionist approves, patient receives socket event + toast + notification
```

### 14.5 Patient — Cancel Confirmed Appointment

```
1. /patient/appointments → upcoming card → click for detail
2. If start_at - now >= 2h, Cancel button is enabled
3. Click → CancelDialog asks for reason
4. POST /api/v1/appointments/{id}/cancel
5. Toast: "Appointment cancelled"
6. Socket 'appointment:cancelled' notifies doctor and clinic staff
```

### 14.6 Patient — Request Reschedule

```
1. /patient/appointments/{id} → "Request reschedule" button (visible only if start_at - now >= 24h)
2. Form: preferred dates + time window + reason
3. Submit → POST /api/v1/appointments/{id}/request-reschedule
4. Toast: "Reschedule request submitted. We'll confirm a new time shortly."
5. Receptionist sees the request in their inbox (request_type='reschedule', shows current appointment context)
6. Receptionist approves with a new slot → old appointment is marked 'rescheduled', new appointment is created
7. Patient receives toast + notification with the new time
```

### 14.7 Clinical Assistant — View & Coordinate

```
1. /clinical-assistant/appointments — list + calendar toggle, filterable by doctor
2. Read-only by default; admin can grant 'edit' permission per clinic policy
3. Real-time updates when receptionist books / patient cancels / request approved
```

---

## 15. Security, Performance & Reliability

### 15.1 Security
- **JWT-only auth** on REST and Socket.IO handshake.
- **Server-side authorisation** in every service-layer call. Frontend role checks are convenience-only.
- **Schedule endpoints fully closed to patient role** at the FastAPI dependency layer (`require_staff_or_doctor`) AND by RLS as defence-in-depth.
- **Patient request flow is the only way patients influence appointment placement**, ensuring schedule remains opaque.
- **Cancellation guard** — patient cancel < 2 h → 400 with clear message; reschedule request < 24 h → 400.
- **Rate limiting** on mutating endpoints via existing `slowapi`.
- **Input validation** — Pydantic v2 strict models reject bad payloads at the boundary.
- **CORS** — Socket.IO origins and REST CORS reference the same `ALLOWED_ORIGINS` setting.
- **Audit trail** for both appointments and requests in single `appointment_history` table.

### 15.2 Performance
- **Composite DB indexes** on `(doctor_id, appointment_date)`, `(clinic_id, status)`, `(patient_id, created_at DESC)` for requests.
- **Slot generation O(days × slots/day)** — computed on demand, no precomputed slots table.
- **Cache schedule reads** at service layer for 30 s using `cachetools`.
- **Redux TTL caching** — appointments list 60 s, requests 30 s, doctor schedule 5 min; socket events invalidate immediately.
- **FullCalendar lazy event fetching** via `events` function for large datasets.
- **Pagination** on list endpoints (default 20, max 100).

### 15.3 Reliability
- **DB-level UNIQUE constraint** on `(doctor_id, appointment_date, start_time)` makes overbooking impossible under races.
- **UNIQUE partial index** prevents two pending reschedule requests against the same appointment.
- **Socket.IO auto-reconnect** with backoff; on reconnect, frontend re-fetches `GET /appointments/upcoming` + `GET /appointment-requests?status=pending` to recover missed events.
- **Idempotent reminder dispatch** — `reminder_*_sent_at` is set inside the same RPC that selects the row.
- **Idempotent request expiry** — `expire_pending_requests()` RPC is transactional.
- **Graceful scheduler shutdown** via FastAPI `lifespan`.
- **Observability hooks** — every service call emits structured logs with `request_id` / `appointment_id`, `actor_id`, `action`.

### 15.4 Data Integrity & Compliance
- Timestamps stored UTC; converted via `date-fns-tz`.
- Soft-cancel only (status flip + audit row). No hard deletes.
- `cancelled_by`, `cancelled_at`, `cancellation_reason` required when status is `cancelled` (CHECK constraint).
- `approved_appointment_id`, `reviewed_by` required when request status is `approved`.
- Linkage `appointment_requests.approved_appointment_id ↔ appointments.appointment_request_id` keeps a bidirectional audit chain.

---

## 16. Testing Strategy

### 16.1 Backend
- **Unit tests** for `schedule_service.generate_slots` covering weekly template, overrides, breaks, timezone edges.
- **Unit tests** for `request_service`:
  - Reject patient with no assigned doctor.
  - Reject duplicate pending new request.
  - Reject reschedule request < 24 h before start.
  - Approve flow creates appointment + updates request atomically.
  - Reject flow stores review_notes.
- **Integration tests** for routers (`pytest-asyncio` + Supabase test schema):
  - Patient cannot hit `/schedule/*` (403).
  - Receptionist approves request → both appointment AND request rows present; appointment.appointment_request_id matches.
  - Race: two receptionists try to approve the same request simultaneously → exactly one succeeds.
  - Race: receptionist approves two different requests onto the same slot → exactly one succeeds (409 from UNIQUE).
  - Patient cancel < 2 h → 400.
  - Patient direct-cancel of someone else's appointment → 403.
- **Socket.IO tests** — `appointment_request:created` arrives on receptionist socket within 500 ms of patient POST.
- **Scheduler tests** — stub clock, run `expire_stale_requests`, verify expired rows + emitted events.

### 16.2 Frontend
- **Component tests** (Vitest + RTL) for `PatientRequestForm` (validation), `RequestReviewPanel` (approve / reject), `BookingWizard`, `TimeSlotGrid`, `AppointmentCalendar`.
- **Redux thunk tests** — happy + error paths for each thunk.
- **Socket reducer test** — dispatch `handleRequestSocketEvent({type:'approved',...})`, assert request moved from `myRequests[pending]` → `myRequests[approved]` and appointment upserted.
- **E2E (Playwright)** — three browser contexts (patient / receptionist / doctor) running concurrently:
  - Patient submits request → receptionist sees it in inbox within 2 s.
  - Receptionist approves → patient sees confirmation toast within 2 s; doctor calendar shows new event within 2 s.
  - Patient cancels confirmed appointment → both doctor and receptionist see real-time update.

### 16.3 Manual QA checklist (per release)
- Submit request as patient → confirm appears in receptionist inbox.
- Approve / reject from receptionist → verify patient receives appropriate notification.
- Patient cannot access `/schedule/*` URLs directly (verify with network DevTools: 403).
- Cancel as patient within / outside the 2-hour window — proper UI gating + backend rejection.
- Reschedule request flow end-to-end.
- 24h and 1h reminders fire.
- Multi-clinic isolation — receptionist of clinic B cannot see clinic A requests.
- Request expiry — set `APPOINTMENT_REQUEST_EXPIRY_HOURS=0.1` in test env, submit request, wait, confirm status flips to `expired`.

---

## 17. Deployment, DevOps & Observability

Container topology, Dockerfile changes, Makefile target, observability and migration steps are unchanged from V1 of this document. Reminder: launch command is `uvicorn app.main:asgi_app`.

The scheduler container additionally runs the `expire_stale_requests` job — verify in production logs after first deploy.

---

## 18. Phased Implementation Roadmap

| Phase | Deliverable | Owner | Effort | Dependencies |
|-------|-------------|-------|--------|--------------|
| **0** | DB migration `002_appointment_system.sql` + RLS applied to staging Supabase | Backend | 0.5 d | — |
| **1** | Pydantic models + `schedule_service.generate_slots` + unit tests | Backend | 1.5 d | Phase 0 |
| **2** | `appointment_service` + `/appointments/*` routers + integration tests | Backend | 2.5 d | Phase 1 |
| **3** | `request_service` + `/appointment-requests/*` routers + integration tests 🆕 | Backend | 2 d | Phase 2 |
| **4** | Socket.IO server + JWT auth + `appointment:*` + `appointment_request:*` emits | Backend | 1.5 d | Phase 3 |
| **5** | APScheduler + reminder jobs + request expiry GC + tests | Backend | 1 d | Phase 4 |
| **6** | Redis adapter + multi-worker validation | DevOps | 0.5 d | Phase 4 |
| **7** | TS types + Redux `appointmentsSlice` + `appointmentRequestsSlice` + `doctorScheduleSlice` + services + endpoints | Frontend | 2.5 d | Phase 3 |
| **8** | `SocketProvider` + global toast + socket reducer wiring | Frontend | 1 d | Phase 4, 7 |
| **9** | Receptionist: appointments list + booking wizard + reschedule modal | Frontend | 3 d | Phase 7, 8 |
| **10** | Receptionist: appointment-requests inbox + `RequestReviewPanel` 🆕 | Frontend | 2 d | Phase 9 |
| **11** | Doctor: FullCalendar view + appointment detail + weekly schedule editor | Frontend | 3 d | Phase 9 |
| **12** | Patient: appointments list + `PatientRequestForm` + cancel + request-reschedule | Frontend | 2.5 d | Phase 9 |
| **13** | Clinical-assistant: view-only list + calendar toggle | Frontend | 0.5 d | Phase 9 |
| **14** | Sidebar nav updates + dashboard "Request Appointment" button + role redirect tweaks | Frontend | 0.5 d | Phase 9 |
| **15** | E2E tests (Playwright) covering all four roles + request flow | QA | 2.5 d | Phases 9–13 |
| **16** | Deployment manifest updates (asgi_app, scheduler container) | DevOps | 1 d | Phase 15 |
| **17** | Manual QA + bug-fix sprint | Team | 2 d | Phase 16 |
| **18** | Production rollout + smoke tests + observability dashboards | Team | 1 d | Phase 17 |

**Total estimated effort: ~28 engineer-days** (parallelisable to ~3 calendar weeks with 2 backend + 2 frontend + 1 QA + 1 DevOps).

---

## 19. File-by-File Reference

### 19.1 Backend (`neurowellness-backend-v1/neurowellness/backend/`)

| File | Action | Purpose |
|------|--------|---------|
| `requirements.txt` | MODIFY | Add `python-socketio`, `python-engineio`, `APScheduler`, `redis`, `python-dateutil` |
| `app/config.py` | MODIFY | Add Redis, Socket.IO, reminder, slot, request-expiry env vars |
| `app/main.py` | MODIFY | `lifespan` (scheduler), register new routers, wrap with `socketio.ASGIApp` → export `asgi_app` |
| `Dockerfile` | MODIFY | CMD → `app.main:asgi_app` |
| `Makefile` | MODIFY | `make dev` target update |
| `app/dependencies.py` | (unchanged) | Reused for socket auth; add `require_staff_or_doctor` helper if not present |
| `app/services/notification.py` | MODIFY | Emit `notification:new` socket event after DB insert |
| `app/socket_io/__init__.py` | NEW | Package init |
| `app/socket_io/server.py` | NEW | `AsyncServer` instance + `mount_socketio` |
| `app/socket_io/auth.py` | NEW | JWT verification reusing `_decode_token` |
| `app/socket_io/events.py` | NEW | `connect`, `disconnect`, room joining |
| `app/socket_io/emitter.py` | NEW | `emit_appointment_event`, `emit_request_event` |
| `app/socket_io/adapter.py` | NEW | Redis adapter factory |
| `app/scheduler/__init__.py` | NEW | Package init |
| `app/scheduler/scheduler.py` | NEW | `AsyncIOScheduler` setup + lifespan hooks |
| `app/scheduler/jobs.py` | NEW | `dispatch_reminders`, `expire_stale_requests`, `cleanup_no_shows` |
| `app/models/appointment.py` | NEW | Pydantic request/response models for appointments |
| `app/models/appointment_request.py` 🆕 | NEW | Pydantic models for requests |
| `app/services/schedule_service.py` | NEW | Slot generation, conflict detection, weekly upsert |
| `app/services/appointment_service.py` | NEW | Booking, cancel, reschedule, confirm, check-in, complete |
| `app/services/request_service.py` 🆕 | NEW | Submit / approve / reject / cancel / expire requests |
| `app/routers/appointments.py` | NEW | `/appointments/*` endpoints |
| `app/routers/appointment_requests.py` 🆕 | NEW | `/appointment-requests/*` endpoints |
| `app/routers/doctor_schedule.py` | NEW | `/schedule/*` endpoints — staff + doctor only |
| `app/utils/timezone.py` | NEW | clinic-tz ↔ UTC helpers |
| `migrations/002_appointment_system.sql` | NEW | All DDL incl. `appointment_requests` |
| `migrations/003_appointment_rpcs.sql` | NEW | `appointments_due_for_reminder`, `expire_pending_requests` RPCs |

### 19.2 Frontend (`prs-neurowellness/`)

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | MODIFY | socket.io-client, FullCalendar plugins, date-fns, date-fns-tz |
| `.env.local.example` | NEW | Document `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_SOCKET_PATH` |
| `src/app/layout.tsx` | MODIFY | Add `<SocketProvider>` + global `<Toaster />` |
| `src/types/appointment.types.ts` | NEW | Appointment, Slot types |
| `src/types/appointmentRequest.types.ts` 🆕 | NEW | AppointmentRequest types |
| `src/lib/api/endpoints.ts` | MODIFY | APPOINTMENTS, SCHEDULE, APPOINTMENT_REQUESTS groups |
| `src/lib/api/services/appointments.service.ts` | NEW | `/appointments/*` wrapper |
| `src/lib/api/services/schedule.service.ts` | NEW | `/schedule/*` wrapper |
| `src/lib/api/services/appointmentRequests.service.ts` 🆕 | NEW | `/appointment-requests/*` wrapper |
| `src/lib/socket/client.ts` | NEW | Singleton Socket.IO factory |
| `src/lib/socket/events.ts` | NEW | Typed event names + payload typedefs |
| `src/lib/hooks/useSocket.ts` | NEW | Returns `{ socket, isConnected }` |
| `src/lib/hooks/useAppointments.ts` | NEW | Fetch + select |
| `src/lib/hooks/useAvailableSlots.ts` | NEW | Doctor slot query (staff/doctor only) |
| `src/lib/hooks/useDoctorSchedule.ts` | NEW | Doctor's own schedule + overrides |
| `src/lib/hooks/useAppointmentRequests.ts` 🆕 | NEW | Staff inbox of requests + approve/reject |
| `src/lib/hooks/useMyAppointmentRequests.ts` 🆕 | NEW | Patient-scoped requests list |
| `src/lib/utils/datetime.ts` | NEW | Slot formatting, clinic tz |
| `src/lib/constants/index.ts` | MODIFY | APPOINTMENT_STATUS, REQUEST_STATUS, APPOINTMENT_ROUTES |
| `src/store/store.ts` | MODIFY | Register `appointments`, `appointmentRequests`, `doctorSchedule` reducers |
| `src/store/slices/appointmentsSlice.ts` | NEW | State + thunks + socket reducer |
| `src/store/slices/appointmentRequestsSlice.ts` 🆕 | NEW | State + thunks + socket reducer |
| `src/store/slices/doctorScheduleSlice.ts` | NEW | State + thunks for schedule + overrides |
| `src/components/providers/SocketProvider.tsx` | NEW | Global socket lifecycle + event dispatch + toasts |
| `src/components/layout/Sidebar.tsx` | MODIFY | Add Appointments + Requests nav per role |
| `src/components/appointments/AppointmentCalendar.tsx` | NEW | FullCalendar wrapper (staff/doctor only) |
| `src/components/appointments/AppointmentCard.tsx` | NEW | List card |
| `src/components/appointments/AppointmentStatusBadge.tsx` | NEW | Coloured badge |
| `src/components/appointments/AppointmentDetailDrawer.tsx` | NEW | Side drawer with actions |
| `src/components/appointments/BookingWizard.tsx` | NEW | Staff-only direct booking wizard |
| `src/components/appointments/DoctorPicker.tsx` | NEW | Staff-only |
| `src/components/appointments/PatientPicker.tsx` | NEW | Staff-only |
| `src/components/appointments/DatePickerInline.tsx` | NEW | Staff-only — uses slots API |
| `src/components/appointments/TimeSlotGrid.tsx` | NEW | Staff-only — uses slots API |
| `src/components/appointments/RescheduleModal.tsx` | NEW | Staff-only direct reschedule |
| `src/components/appointments/CancelDialog.tsx` | NEW | Used by patient + staff |
| `src/components/appointments/WeeklyScheduleEditor.tsx` | NEW | Doctor schedule page |
| `src/components/appointments/PatientRequestForm.tsx` 🆕 | NEW | Patient — preferred dates + complaint (no slot picker) |
| `src/components/appointments/PatientRescheduleRequestForm.tsx` 🆕 | NEW | Patient — submit reschedule request |
| `src/components/appointments/RequestCard.tsx` 🆕 | NEW | List card for request inbox + patient view |
| `src/components/appointments/RequestReviewPanel.tsx` 🆕 | NEW | Receptionist approve / reject UI |
| `src/components/appointments/RequestStatusBadge.tsx` 🆕 | NEW | Coloured badge |
| `src/app/(roles)/patient/appointments/page.tsx` | NEW | Upcoming / Past / Requests tabs |
| `src/app/(roles)/patient/appointments/request/page.tsx` 🆕 | NEW | Patient new-request form |
| `src/app/(roles)/patient/appointments/[id]/page.tsx` | NEW | Detail + Cancel + Request Reschedule |
| `src/app/(roles)/patient/dashboard/page.tsx` | MODIFY | "Request Appointment" button → `/patient/appointments/request` |
| `src/app/(roles)/doctor/appointments/page.tsx` | NEW | FullCalendar |
| `src/app/(roles)/doctor/appointments/[id]/page.tsx` | NEW | Detail + actions |
| `src/app/(roles)/doctor/schedule/page.tsx` | NEW | Weekly schedule + overrides |
| `src/app/(roles)/receptionist/appointments/page.tsx` | NEW | List + calendar toggle |
| `src/app/(roles)/receptionist/appointments/book/page.tsx` | NEW | Direct-booking wizard |
| `src/app/(roles)/receptionist/appointments/[id]/page.tsx` | NEW | Detail + actions |
| `src/app/(roles)/receptionist/appointment-requests/page.tsx` 🆕 | NEW | Pending-request inbox |
| `src/app/(roles)/receptionist/appointment-requests/[id]/page.tsx` 🆕 | NEW | Request review (RequestReviewPanel) |
| `src/app/(roles)/receptionist/dashboard/page.tsx` | MODIFY | Add Today's Appointments + Pending Requests widgets |
| `src/app/(roles)/clinical-assistant/appointments/page.tsx` | NEW | Read-only list + calendar |

---

## 20. Acceptance Criteria

### 20.1 Functional
- [ ] A receptionist of Clinic A can register a new patient and **book an appointment directly** against any doctor of Clinic A in under 60 seconds.
- [ ] A patient of Clinic A can submit an **appointment request** (with preferred dates + complaint) in under 30 seconds; the request appears in the receptionist inbox within 2 seconds.
- [ ] A receptionist can review a request, view their target doctor's available slots, **approve with a chosen slot**, and the patient receives confirmation toast within 2 seconds.
- [ ] A receptionist can **reject a request with a reason** that is shown to the patient.
- [ ] A patient **cannot access** any `/schedule/*` endpoint, the receptionist booking wizard, or the doctor's calendar (verified by URL access + network requests).
- [ ] A patient can **cancel** their confirmed appointment when ≥ 2 hours before start; UI hides button and backend returns 400 inside that window.
- [ ] A patient can **submit a reschedule request** when ≥ 24 hours before start.
- [ ] A doctor sees a new appointment appear on their calendar within 2 seconds of creation, without page refresh.
- [ ] A doctor can drag-drop an appointment on their calendar to reschedule; patient receives `appointment:rescheduled` event + notification.
- [ ] A doctor can mark a date as a leave override; that date no longer offers slots in the receptionist's slot picker within 60 seconds (TTL).
- [ ] Two receptionists approving two requests onto the same slot — exactly one succeeds; the other gets a 409 and is prompted to choose another slot.
- [ ] Two receptionists approving the same request simultaneously — exactly one succeeds.
- [ ] 24h and 1h reminders fire for every appointment in `scheduled`/`confirmed` status.
- [ ] Pending requests older than `APPOINTMENT_REQUEST_EXPIRY_HOURS` flip to `expired` and notify the patient + clinic staff.
- [ ] Receptionist of Clinic A cannot see any appointment, request, doctor, or patient belonging to Clinic B (API + RLS).
- [ ] Doctor marking an appointment `completed` automatically creates / links a `sessions` row, preserving the existing clinical workflow.
- [ ] All notifications appear in the bell drawer with correct icons, links, and read state, and persist across reloads.

### 20.2 Non-Functional
- [ ] p95 latency on `POST /appointments` < 400 ms.
- [ ] p95 latency on `POST /appointment-requests` < 300 ms.
- [ ] p95 latency on `POST /appointment-requests/{id}/approve` < 600 ms (includes appointment creation).
- [ ] p95 latency on `GET /schedule/.../slots?from_date=...&to_date=...` (14-day range) < 300 ms.
- [ ] Socket.IO event delivery p95 < 1 s end-to-end.
- [ ] Backend memory stable under 24h soak test of 1 appointment / sec + 0.5 request / sec.
- [ ] Frontend bundle size increase from new dependencies < 250 KB gzipped (patient bundle stays smaller because it doesn't include FullCalendar).
- [ ] Lighthouse Accessibility ≥ 90 on every new page.
- [ ] 100% type coverage on new TypeScript code (no `any` in services / slices).
- [ ] ≥ 80% unit-test coverage on new backend modules.

### 20.3 Operational
- [ ] Scheduler container survives `docker restart` without losing jobs (RedisJobStore).
- [ ] API containers can scale 1 → 5 replicas without duplicate Socket.IO events (Redis adapter verified).
- [ ] Rolling deploy completes with zero appointment writes lost.
- [ ] `expire_stale_requests` job logs visible in production scheduler container daily.

---

## Appendix A — Sample End-to-End Sequence (Request Flow)

**Scenario**: Patient in Mumbai clinic submits a request; receptionist approves it with a chosen slot at 10:30 AM on 2026-06-15 with Dr. Sharma.

```
1. Frontend (browser, patient)
   ─ POST /api/v1/appointment-requests
     Body: { preferred_date_1:"2026-06-15", preferred_date_2:"2026-06-16",
             preferred_time_window:"morning",
             patient_complaint:"Anxiety has worsened over the past week",
             urgency:"normal" }
     Headers: Authorization: Bearer <jwt>

2. FastAPI router → require_patient → request_service.create_new_request(...)
   ─ Look up assigned_doctor_id from patients table ✓
   ─ Reject if any pending 'new' request exists ✓
   ─ INSERT into appointment_requests (status='pending')
   ─ INSERT into appointment_history (entity_type='request', action='request_submitted')
   ─ notification.send_notification(patient_id, "appointment_request_submitted", ...)
   ─ notification.send_notification(receptionist_id, "appointment_request_submitted", ...) for each receptionist of clinic
   ─ socket_io.emitter.emit_request_event("appointment_request:created", request,
                                          clinic_id=clinic, patient_id=patient)
       ├─ sio.emit → room "user:<patient>"
       └─ sio.emit → room "clinic:<clinic>"   (receptionists, clinical assistants)
   ─ return success_response(request, "Request submitted")

3. Frontend (browser, patient)
   ─ axios resolves → dispatch submitAppointmentRequest.fulfilled → myRequests updated
   ─ toast.success("Your appointment request has been submitted...")
   ─ Also receives socket "appointment_request:created" → upsert (no-op since already present)

4. Frontend (browser, receptionist)
   ─ SocketProvider receives "appointment_request:created" → reducer adds to clinicRequests
   ─ Sidebar badge increments
   ─ toast.info("New appointment request from <patient_name>")
   ─ Receptionist clicks the request → /receptionist/appointment-requests/{id}

5. Frontend (receptionist) — fetch slots
   ─ GET /api/v1/schedule/doctor/<doctor_id>/slots?from_date=2026-06-15&to_date=2026-06-15
   ─ Display available slots; receptionist selects 10:30
   ─ POST /api/v1/appointment-requests/<request_id>/approve
     Body: { appointment_date:"2026-06-15", start_time:"10:30:00",
             appointment_type:"consultation" }

6. FastAPI router → require_receptionist_or_admin → request_service.approve_request(...)
   ─ Load request, must be 'pending' ✓
   ─ appointment_service.create_appointment(AppointmentCreate(
       patient_id, doctor_id, appointment_date="2026-06-15", start_time="10:30",
       appointment_type="consultation",
       patient_complaint="Anxiety has worsened over the past week",
       appointment_request_id=request_id,
     ))
       └─ Emits 'appointment:created' to user:<patient>, doctor:<doctor>, clinic:<clinic>
       └─ Creates appointment_history (entity_type='appointment', action='created')
       └─ Sends notifications to patient + doctor
   ─ UPDATE request SET status='approved', approved_appointment_id, reviewed_by, reviewed_at
   ─ INSERT appointment_history (entity_type='request', action='request_approved')
   ─ socket_io.emitter.emit_request_event('appointment_request:approved',
       { request, appointment }, clinic_id, patient_id)

7. Frontend (browser, patient)
   ─ Receives socket "appointment:created" → upsert in appointmentsSlice
   ─ Receives socket "appointment_request:approved" → request moves from pending → approved
   ─ toast.success("Your appointment is confirmed for 2026-06-15 at 10:30")
   ─ Bell icon counter +1 (notification:new)

8. Frontend (browser, doctor)
   ─ Receives "appointment:created" → FullCalendar shows event at Mon 10:30 next render cycle
   ─ Bell icon counter +1
```

This is the canonical happy-path the entire team should be able to trace through the codebase after Phase 14 is complete.
