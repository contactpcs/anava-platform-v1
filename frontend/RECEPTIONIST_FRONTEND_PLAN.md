# Receptionist / Front Desk — Frontend Design Plan
**NeuroWellness Platform · Version 1.0**
**Date:** May 2026
**Scope:** UI/UX screens, navigation, data fields, buttons, flows, and backend endpoints for the Receptionist role.

> **Note:** Appointment booking and payment screens are scoped for a later sprint. Everything else below is the current build target.

---

## Table of Contents
1. [Role Overview](#role-overview)
2. [Navigation Sidebar](#navigation-sidebar)
3. [Screen 1 — Dashboard](#screen-1-dashboard)
4. [Screen 2 — All Patients](#screen-2-all-patients)
5. [Screen 3 — Pending Approvals](#screen-3-pending-approvals)
6. [Screen 4 — Register New Patient](#screen-4-register-new-patient)
7. [Screen 5 — Patient Detail](#screen-5-patient-detail)
8. [Screen 6 — Today's Schedule](#screen-6-todays-schedule)
9. [Screen 7 — All Appointments](#screen-7-all-appointments)
10. [Screen 8 — Book Appointment](#screen-8-book-appointment)
11. [Screen 9 — Doctor Availability](#screen-9-doctor-availability)
12. [Screen 10 — Outstanding Payments](#screen-10-outstanding-payments)
13. [Screen 11 — Payment History](#screen-11-payment-history)
14. [Screen 12 — Notifications](#screen-12-notifications)
15. [Backend Endpoints Required](#backend-endpoints-required)
16. [Build Priority Order](#build-priority-order)

---

## Role Overview

The Receptionist is the **operational hub** of a clinic. They are the first point of contact for patients — by phone, walk-in, or online registration. Every receptionist account is **scoped to one clinic**: they only see patients, doctors, appointments, and payments belonging to their assigned clinic.

**Core responsibilities this UI must support:**
- Reviewing and approving/rejecting self-registered patients
- Registering walk-in and phone-intake patients directly
- Managing doctor assignment per patient
- Booking, rescheduling, and cancelling appointments
- Checking patients in on arrival
- Recording payments at the counter
- Monitoring doctor availability

**What the receptionist CANNOT do (by design):**
- View or modify clinical/medical assessment data (PRS scores, anamnesis)
- Grant assessment permissions to patients (doctor-only)
- See patients from other clinics
- Access admin-level functions (creating staff, managing clinics)

---

## Navigation Sidebar

Always visible on desktop. Collapses to icon-only on narrow screens. Clinic name and logged-in user shown at the top.

```
┌─────────────────────────┐
│  🏥 Neurowellness        │
│  Magarpatta Clinic       │
│  ─────────────────────  │
│  👤 Priya S. (Front Desk)│
├─────────────────────────┤
│  📊  Dashboard           │
│                          │
│  👥  Patients            │
│   ├─ All Patients        │
│   ├─ Pending Approvals 🔴│  ← live badge with count
│   └─ Register Patient    │
│                          │
│  📅  Appointments        │
│   ├─ Today's Schedule    │
│   ├─ All Appointments    │
│   └─ Book Appointment    │
│                          │
│  👨‍⚕️  Doctors             │
│   └─ Availability        │
│                          │
│  💳  Payments            │
│   ├─ Outstanding         │
│   └─ History             │
│                          │
│  🔔  Notifications    🔴 │
│                          │
│  ─────────────────────  │
│  ⚙️  My Profile           │
│  🚪  Logout              │
└─────────────────────────┘
```

**Sidebar rules:**
- "Pending Approvals" shows a live red badge with the count of pending patients.
- "Notifications" shows a badge with unread count.
- Active nav item is highlighted with a left border accent + bold text.
- Sidebar header shows the clinic name (from logged-in user's profile `clinic_id`).

---

## Screen 1: Dashboard

**Route:** `/receptionist/dashboard`
**Purpose:** At-a-glance view of everything that needs action today. This is the landing screen after login.

### Stat Cards (top row, 4 cards)

| Card | Data Source | Accent Colour | Click Navigates To |
|------|------------|---------------|--------------------|
| Total Patients | `patients_summary.total` | Indigo | All Patients |
| Pending Approvals | `patients_summary.pending_approval` | Amber (bold red if > 0) | Pending Approvals |
| Today's Appointments | `upcoming_sessions` count | Blue | Today's Schedule |
| Outstanding Payments | Payment records unpaid | Orange | Outstanding Payments |

**API:** `GET /api/v1/staff/dashboard`

---

### Widget 1: Pending Approvals

Only rendered if `pending_approval > 0`. Uses an amber-bordered card to stand out.

- Title: **"Pending Patient Registrations (N)"**
- Rows show: Patient full name, email, "Registered X hours ago"
- Per row buttons: **Approve** (green) · **Reject** (red) · **View Details** (text link)
- Footer: **"View all N pending →"** navigates to Pending Approvals screen
- Max 5 rows shown; remaining count shown in footer link

**API calls:** `GET /staff/patients/pending?limit=5`, `PUT /staff/patients/{id}/approve`, `PUT /staff/patients/{id}/reject`

---

### Widget 2: Today's Appointments Timeline

- Title: **"Today — Mon 5 May"** with `<` `>` date arrows
- Rows sorted by time: `09:00 — Shiva Kumar — Dr. Amit Kumar — First Visit — [Scheduled]`
- Status badges: `Scheduled` (blue), `Checked In` (teal), `In Progress` (green), `Completed` (grey), `No Show` (red), `Cancelled` (strikethrough grey)
- Per row: **Check In** button (only when status = Scheduled), **No Show** text link
- Footer: **"View full schedule →"**

**API:** `GET /staff/appointments/today` *(to be built)*

---

### Widget 3: Quick Action Buttons

Three large buttons below the stat cards:

| Button | Label | Action |
|--------|-------|--------|
| Primary (blue) | + Register Patient | Navigate to Register Patient |
| Secondary | Book Appointment | Navigate to Book Appointment |
| Secondary | View All Pending | Navigate to Pending Approvals |

---

### Widget 4: Recent Registrations

Small table showing last 5 patients registered at this clinic.

Columns: Name · Email · Registered at · Assigned Doctor

No actions — read-only. "View all patients →" footer link.

---

## Screen 2: All Patients

**Route:** `/receptionist/patients`
**Purpose:** Full searchable, filterable list of all active (approved) patients at this clinic.

### Header Row
- Title: **"Patients (N total)"**
- Search input: searches name, email, phone (client-side or server `?search=`)
- Filter: **All Doctors** | Dr. Amit Kumar | Dr. Mohan Naidu (populated from `GET /staff/doctors`)
- Filter: **All Statuses** | Active | Inactive
- Right: **+ Register Patient** button (primary)

### Table Columns

| Column | Content |
|--------|---------|
| Patient | Avatar initials circle + Full Name (bold) + Email (grey below) |
| Phone | Phone number |
| Assigned Doctor | Doctor name + specialization tag |
| Registered | Formatted date |
| Last Visit | Date of most recent session, or "—" |
| Payment Status | `Paid` (green) / `Pending` (amber) / `Overdue` (red) badge |
| Actions | **View** · **Book Appt** · **⋮** (dropdown) |

**⋮ dropdown options:** Edit Profile · Reassign Doctor · View Appointments · Record Payment

### Pagination
20 per page. "Showing 1–20 of 47" label. Page number buttons at bottom.

**API:** `GET /staff/patients?limit=20&skip=0&search=X`

---

## Screen 3: Pending Approvals

**Route:** `/receptionist/patients/pending`
**Purpose:** Full-page dedicated review of self-registered patients waiting for approval. The most time-sensitive screen.

### Header
- Title: **"Pending Approvals (N)"**
- Subtitle: *"Patients who self-registered online and are waiting for your clinic's approval."*
- Right: **Approve All** button (shown only if ≤ 10 pending, always requires confirmation dialog)

### Patient Review Cards

Each pending patient is rendered as a card — not a table row — because the receptionist needs to review details before acting. Cards are sorted by registration time (oldest first).

```
┌──────────────────────────────────────────────────────────────┐
│  👤 Shiva Kumar                           Registered 2h ago  │
│  shiva@gmail.com · +91 98765 43210                           │
│  Pune, Maharashtra                                           │
│                                                              │
│  Chief Complaint:  "Persistent headaches for 3 months"       │
│  Medical History:  "No prior diagnosis. Family history of…"  │
│                                                              │
│  Auto-assigned doctor:  Dr. Amit Kumar (Neurology) — 12/50  │
│  [ Change Doctor ▾ ]  →  dropdown to reassign before approve │
│                                                              │
│         [ ✓  Approve Patient ]        [ ✗  Reject ]          │
└──────────────────────────────────────────────────────────────┘
```

**Interaction rules:**
- Approving: shows 2-second success toast → card animates out
- Rejecting: confirmation dialog — *"Are you sure? This permanently deletes their registration."* → on confirm, card animates out
- "Change Doctor" dropdown shows all clinic doctors with patient count and availability status
- Doctor change is saved before or as part of the approve action

**API:** `GET /staff/patients/pending`, `PUT /staff/patients/{id}/approve`, `PUT /staff/patients/{id}/reject`, `POST /staff/patients/{id}/allocate`

---

## Screen 4: Register New Patient

**Route:** `/receptionist/patients/register`
**Purpose:** Register a patient who walked in, called, or was referred. No approval required — account is immediately active.

This is a **3-step wizard** with a progress indicator at the top.

```
  ① Personal Details  ─────  ② Medical Info  ─────  ③ Assign & Confirm
```

---

### Step 1: Personal Details

| Field | Input Type | Required | Notes |
|-------|-----------|----------|-------|
| Full Name | Text | ✓ | |
| Date of Birth | Date picker | ✓ | Show calculated age next to field |
| Gender | Radio: Male / Female / Other / Prefer not to say | ✓ | |
| Mobile Number | Tel | ✓ | |
| Email Address | Email | ✓ | Used as login username |
| Password | Password | ✓ | Show "Auto-generate" button option |
| City | Text | | |
| State | Text / Select | | |
| Address | Textarea | | |
| Country | Select | | Default: India |

**Navigation:** **Next →** button (validates required fields before proceeding)

---

### Step 2: Medical Information

| Field | Input Type | Required | Notes |
|-------|-----------|----------|-------|
| Chief Complaint / Reason for Visit | Textarea | ✓ | Why is the patient coming today |
| Relevant Medical History | Textarea | | Past conditions, prior diagnoses |
| Current Medications | Textarea | | Names and dosages |
| Known Allergies | Text | | |
| Emergency Contact Name | Text | | |
| Emergency Contact Phone | Tel | | |
| Relationship to Patient | Select: Spouse / Parent / Sibling / Friend / Other | | |

**Navigation:** **← Back** and **Next →** buttons

---

### Step 3: Assign & Confirm

| Field | Input Type | Notes |
|-------|-----------|-------|
| Assign to Doctor | Searchable select | Shows: `Dr. Name — Specialization — X/50 patients — ● Available` |
| Book Appointment Now? | Toggle (Yes / No) | If Yes, expand date/time fields below |
| → Appointment Date | Date picker | Only shown if toggle is Yes |
| → Time Slot | Select | Populates dynamically from doctor's available slots |
| → Session Type | Select: First Visit / Follow-up / Consultation / Emergency | |
| → Notes for Doctor | Textarea | Pre-visit notes visible to doctor |

**After clicking "Register Patient":**

Show a **Confirmation Summary card** with all entered details. Two buttons: **Confirm & Register** (primary) and **← Back to Edit**.

**On success:** Full-screen success state showing:
- Patient name and avatar
- Login email (the one entered)
- Assigned doctor
- Appointment booked (if applicable)
- Two buttons: **Register Another Patient** and **View Patient Profile**

**API:** `POST /staff/patients/register`

---

## Screen 5: Patient Detail

**Route:** `/receptionist/patients/:patientId`
**Purpose:** The full profile of one patient as seen by the receptionist. Mix of editable (contact/logistics) and read-only (clinical) data.

### Header Band

```
[ Avatar ]  Shiva Kumar                         [ Book Appointment ]  [ Edit Profile ]
            shiva@gmail.com  ·  +91 98765 43210
            Pune, Maharashtra  ·  Registered 12 Jan 2026
            Dr. Amit Kumar (Neurology)                  Status:  Active ●
```

---

### Tab 1: Profile

Two columns:

**Left — Personal Details** *(editable by receptionist)*
- Full Name, Date of Birth, Age (auto-calculated), Gender
- Mobile Number, Email Address
- Address, City, State, Country
- **Emergency Contact:** Name, Phone, Relationship

**Right — Medical Summary** *(read-only for receptionist)*
- Chief Complaint
- Medical History
- Current Medications
- Known Allergies
- Small italic note: *"Clinical details are managed by the assigned doctor."*

**Edit Profile** button in header → opens a slide-over drawer with only the personal/contact fields. Save calls `PUT /staff/patients/{id}` *(new endpoint required)*.

---

### Tab 2: Appointments

**Upcoming** section (cards):
```
┌─────────────────────────────────────────────────────┐
│  Mon, 12 May 2026  ·  10:30 AM                      │
│  Dr. Amit Kumar  ·  First Visit  ·  In-person       │
│  Status: Scheduled ●                                 │
│                          [ Cancel ]  [ Reschedule ]  │
└─────────────────────────────────────────────────────┘
```

**Past** section (table):
Columns: Date · Doctor · Session Type · Status

Top right: **+ Book Appointment** button

Empty state: illustration + "No appointments yet" + **Book First Appointment** CTA button

---

### Tab 3: Doctor Assignment

```
Currently Assigned:
┌───────────────────────────────────────────┐
│  Dr. Amit Kumar                           │
│  Neurology  ·  Apollo Hospital            │
│  12 patients / 50 max  ·  ● Available    │
│                               [ Reassign ]│
└───────────────────────────────────────────┘
```

**Reassign** button → opens a panel listing all clinic doctors with load, specialization, and availability. Receptionist selects → optional notes field → **Confirm Reassignment**.

**Assignment History** below (read-only table):
- "Assigned to Dr. Mohan Naidu on 1 Apr 2026"
- "Reassigned to Dr. Amit Kumar on 15 Apr 2026"

**API:** `POST /staff/patients/{id}/allocate`, `GET /staff/doctors`

---

### Tab 4: Payments

```
Payment Status:   ● Pending
Last Payment:     —
Outstanding:      ₹500  (Consultation · 2 May 2026)

[ + Record Payment ]

Payment History:
────────────────────────────────────────────────────────
Date          Session          Amount    Method   Status
────────────────────────────────────────────────────────
2 May 2026    First Visit      ₹500      —        Pending
────────────────────────────────────────────────────────
```

**Record Payment** button opens the Record Payment modal (see Screen 10).

**API:** `GET /staff/patients/{id}/payments` *(to be built)*

---

## Screen 6: Today's Schedule

**Route:** `/receptionist/appointments/today`
**Purpose:** The primary operational screen during clinic hours. Shows all appointments for today at this clinic.

### Header
- Title: **"Today's Schedule — Monday, 5 May 2026"**
- `<` `>` arrows navigate between days
- Doctor filter tabs: **All Doctors** · Dr. Amit Kumar (8) · Dr. Mohan Naidu (5)
- Right: **+ Book Appointment** button

### Timeline

Time slots from 09:00 to 18:00. Each booked slot:

```
09:00 ┤  Shiva Kumar         Dr. Amit Kumar   First Visit    [ Check In ]
      │  +91 98765 43210      Neurology
      │                                        ● Scheduled

10:00 ┤  Sanjana Patel       Dr. Amit Kumar   Follow-up      [ Check In ]
      │                                        ● Scheduled

11:30 ┤  Jaswanth Rao        Dr. Amit Kumar   Consultation   ● Checked In
      │                                        [ In Progress ]  [ No Show ]

13:00 ┤  ─── LUNCH BREAK ───

14:00 ┤  [ Empty slot — click to book ]
```

**Status progression buttons:**
- `Scheduled` → **[ Check In ]**
- `Checked In` → **[ Mark In Progress ]** + **[ No Show ]**
- `In Progress` → **[ Mark Completed ]**
- `Completed` → label only, no action
- `No Show` → red label, no action

Clicking a patient name opens a **mini side panel** (no page navigation) showing: Photo, name, phone, doctor, and quick links to patient profile and payment.

**API:** `GET /staff/appointments/today`, `PUT /staff/appointments/{id}/checkin`, `PUT /staff/appointments/{id}/noshow` *(to be built)*

---

## Screen 7: All Appointments

**Route:** `/receptionist/appointments`
**Purpose:** Full historical and future appointment list with filters.

### Filter Row
- Date range picker (default: current week)
- Doctor dropdown
- Status: All / Scheduled / Completed / Cancelled / No Show
- Search by patient name

### Table

| Column | Content |
|--------|---------|
| Date & Time | 5 May 2026, 09:00 AM |
| Patient | Name + phone |
| Doctor | Name + specialization |
| Type | First Visit / Follow-up / Consultation / Emergency |
| Mode | In-person / Teleconsult |
| Status | Status badge |
| Actions | View Patient · Cancel · Reschedule |

### Calendar View Toggle

Button to switch to **Week/Month calendar view**. Appointments shown as colour-coded blocks (one colour per doctor). Clicking a block opens the appointment side panel.

**API:** `GET /staff/appointments` *(to be built)*

---

## Screen 8: Book Appointment

**Route:** `/receptionist/appointments/book`
**Purpose:** Create a new appointment for any patient with any clinic doctor.

Accessible from: Dashboard quick action · Patient Detail tab · Today's Schedule empty slot · Sidebar nav.

### Form Sections

**Section 1: Patient**
- Patient search (type to search by name / phone / email)
- Shows recent patients as suggestions below the input
- If navigated from Patient Detail, patient is pre-filled and locked (non-editable)

**Section 2: Doctor & Slot**
- Doctor select: `Dr. Name — Specialization — ● Available`
- Date picker: selecting a date loads available slots for that doctor
- Time slot grid: `09:00 | 09:30 | 10:00 | 10:30 ...` — booked slots greyed out and unselectable
- Session Type: First Visit / Follow-up / Consultation / Emergency / Teleconsult

**Section 3: Visit Details**
- Chief complaint / reason (brief, sent to doctor)
- Internal notes for front desk (not visible to doctor or patient)
- Send confirmation SMS to patient? (toggle)

**[ Book Appointment ]** primary button at bottom.

**On success:** Appointment summary card + "Add to Today's Schedule" message if the appointment is today.

**API:** `POST /staff/appointments` *(to be built)*, `GET /staff/doctors/{id}/slots` *(to be built)*

---

## Screen 9: Doctor Availability

**Route:** `/receptionist/doctors`
**Purpose:** Read-only view of all doctors at this clinic. Used before booking to check load and availability.

### Doctor Cards Grid

```
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  Dr. Amit Kumar              │   │  Dr. Mohan Naidu             │
│  Neurology                   │   │  Neuropsychiatry              │
│  ● Available                 │   │  ● Busy (In Session)         │
│                              │   │                              │
│  Today:  6 appts / 10 slots  │   │  Today:  8 appts / 10 slots  │
│  Total patients:  12 / 50    │   │  Total patients:  9 / 50     │
│                              │   │                              │
│        [ View Schedule ]     │   │        [ View Schedule ]     │
└──────────────────────────────┘   └──────────────────────────────┘
```

**Availability statuses:** `● Available` (green) · `● In Session` (teal) · `● On Break` (amber) · `● On Leave` (red) · `● Unavailable` (grey)

**View Schedule** opens a week-view calendar for that doctor showing all booked appointments and free slots.

**API:** `GET /staff/doctors`

---

## Screen 10: Outstanding Payments

**Route:** `/receptionist/payments/outstanding`
**Purpose:** Track patients with unpaid sessions. Minimal billing — just enough to record counter payments.

### Filters
- Doctor dropdown
- Date range picker
- Amount range

### Table

| Column | Content |
|--------|---------|
| Patient | Name + phone |
| Session Date | Date of the visit |
| Doctor | Attending doctor name |
| Session Type | First Visit / Follow-up |
| Amount Due | ₹500 |
| Due Since | "3 days" |
| Actions | **Record Payment** · Remind |

### Record Payment Modal

Triggered by **Record Payment** button per row.

| Field | Type | Notes |
|-------|------|-------|
| Patient | Pre-filled, locked | |
| Session | Pre-filled, locked | |
| Amount Received | Number input | Pre-filled with amount due |
| Payment Method | Select: Cash / Card / UPI / NEFT / Insurance / Complimentary | |
| Transaction / Receipt No. | Text | Auto-generate option |
| Payment Date | Date picker | Defaults to today |
| Notes | Textarea | Optional |

**[ Confirm Payment ]** button. On success: payment status changes to **Paid**, row disappears from Outstanding list with animation.

**API:** `POST /staff/payments`, `GET /staff/payments?status=pending` *(to be built)*

---

## Screen 11: Payment History

**Route:** `/receptionist/payments/history`
**Purpose:** Full audit log of all payments at this clinic.

### Filters
- Date range picker
- Patient search
- Doctor dropdown
- Payment method
- Status: All / Paid / Pending / Waived

### Table

| Column | Content |
|--------|---------|
| Date | Payment date |
| Patient | Name |
| Doctor | Name |
| Session | Type + session date |
| Amount | ₹ amount |
| Method | Cash / UPI / Card / etc. |
| Receipt No. | Auto or manual |
| Status | `Paid` (green) / `Pending` (amber) / `Waived` (grey) |

**Export to CSV** button top-right (end-of-day reconciliation).

**API:** `GET /staff/payments` *(to be built)*

---

## Screen 12: Notifications

**Route:** `/receptionist/notifications`
**Purpose:** Centralised notification centre.

### Layout
- Bell icon in sidebar header with unread count badge
- Full page: notification items sorted by recency
- Each item: icon, title, description, time ago, read/unread indicator dot
- **Mark all as read** button top-right

### Notification Types the Receptionist Receives

| Type | Trigger | Action inline |
|------|---------|---------------|
| New self-registration | Patient self-registers online to this clinic | Approve / Reject inline |
| Appointment cancelled | Patient cancels via patient portal | View appointment |
| Doctor unavailable | Doctor marks themselves unavailable | View schedule |
| Payment overdue | Configurable after N days | Record payment |

**API:** `GET /notifications`, `PUT /notifications/{id}/read`, `PUT /notifications/read-all`

---

## Backend Endpoints Required

All endpoints prefixed with `/api/v1`. Endpoints marked ✓ already exist. Endpoints marked *(build)* need to be created.

### Existing (use as-is)

| Endpoint | Method | Notes |
|----------|--------|-------|
| `/staff/dashboard` | GET | ✓ Returns stats + upcoming sessions |
| `/staff/patients` | GET | ✓ Approved patients, clinic-scoped |
| `/staff/patients/pending` | GET | ✓ Pending approval patients |
| `/staff/patients/register` | POST | ✓ Walk-in registration |
| `/staff/patients/{id}` | GET | ✓ Patient detail |
| `/staff/patients/{id}/approve` | PUT | ✓ |
| `/staff/patients/{id}/reject` | PUT | ✓ |
| `/staff/patients/{id}/allocate` | POST | ✓ Reassign doctor |
| `/staff/doctors` | GET | ✓ Clinic doctors with load |
| `/notifications` | GET | ✓ |

### To Be Built

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/staff/patients/{id}` | PUT | Update patient contact/personal details |
| `/staff/appointments` | GET | All appointments for clinic (filters: date range, doctor, status) |
| `/staff/appointments/today` | GET | Today's appointments for clinic |
| `/staff/appointments` | POST | Book a new appointment |
| `/staff/appointments/{id}` | PUT | Reschedule (update date / time / doctor) |
| `/staff/appointments/{id}/checkin` | PUT | Mark patient as checked in |
| `/staff/appointments/{id}/cancel` | PUT | Cancel appointment |
| `/staff/appointments/{id}/noshow` | PUT | Mark as no-show |
| `/staff/doctors/{id}/slots` | GET | Available time slots for a doctor on a given date |
| `/staff/payments` | GET | Payment records for clinic |
| `/staff/payments` | POST | Record a new payment |
| `/staff/payments/{id}` | PUT | Update payment record |
| `/staff/patients/{id}/payments` | GET | Payment history for one patient |

### DB Columns to Add to `sessions` table
To support appointments and payments without a separate table initially:
```
clinic_id         UUID    FK → clinics
notes             TEXT
mode              TEXT    'in_person' | 'teleconsult'
chief_complaint   TEXT
amount_due        NUMERIC
payment_status    TEXT    'pending' | 'paid' | 'waived'
payment_method    TEXT    'cash' | 'card' | 'upi' | 'neft' | 'insurance' | 'complimentary'
receipt_no        TEXT
paid_at           TIMESTAMPTZ
```

---

## Build Priority Order

### Sprint 1 — Patient Intake Flow (Days 1–2)
These unlock the core receptionist workflow described in the onboarding flow.

1. **Pending Approvals page** — expandable cards with inline Approve/Reject + doctor reassignment before approving
2. **Register Patient wizard** — 3-step form (Personal → Medical → Assign & Confirm)
3. **Patient Detail page** — all 4 tabs (Profile, Appointments, Doctor, Payments)
4. **Dashboard** — stat cards + pending widget + today's appointments widget + quick action buttons + recent registrations

### Sprint 2 — Appointments (Days 3–4)
5. **Today's Schedule** — timeline view with Check In / No Show / In Progress actions
6. **Book Appointment form** — patient search, doctor + slot picker, session type
7. **All Appointments** — list view with filters + calendar toggle
8. **Doctor Availability** — card grid with status + View Schedule

### Sprint 3 — Payments & Polish (Days 5–6)
9. **Outstanding Payments** — list + Record Payment modal
10. **Payment History** — table with CSV export
11. **Notifications page** — with inline approve/reject for new registrations
12. **Sidebar live badge counts** — pull pending count and unread notification count on mount

---

*Document prepared by the NeuroWellness technical team. For questions, contact the project lead.*
