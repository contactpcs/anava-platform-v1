# Data Collection & Privacy Consent

**NeuroWellness Platform**  
**Document version:** v1.0 · **Effective:** 2026-05-07

> This consent is presented to the user at the point of registration / first login and must be agreed to before an account becomes active. It is the data-handling counterpart to the clinical treatment consent (see `PATIENT_CONSENT_FORM.md`) and is intentionally concise so it can be rendered in a registration modal or first-login overlay.

---

## A. Patient Consent (shown at self-registration)

By creating an account on the **NeuroWellness Platform** ("the Platform"), I acknowledge and agree to the following:

### 1. Information I am providing

I am submitting personal information (name, date of birth, gender, email, phone, address, emergency contact) and health-related information (medical history, current medications, symptoms) so that my registering clinic can provide me with care.

### 2. How my information will be used

My data will be used to:
- Identify me as a patient and create my Electronic Medical Record (EMR)
- Allocate me to a treating doctor at my registering clinic
- Administer clinical assessments (Patient Rating Scales) to support my diagnosis and care
- Communicate with me about my appointments, results, and account status
- Improve the Platform through **anonymized, aggregated** analytics

### 3. Who can access my information

Only authorized staff at my registering clinic — my treating doctor, clinical assistant, receptionist, and clinic administrator — can access my data, on a role-based, need-to-know basis. All access is logged. My data is **isolated to my clinic** and is not visible to other clinics on the Platform.

### 4. Where my data is stored and how it is protected

My data is stored on secure cloud infrastructure (Supabase / PostgreSQL) with encryption at rest and in transit (HTTPS/TLS), role-based access controls, and JWT-based authentication. Access is governed by row-level security policies enforced at the database layer.

### 5. How long my data is kept

Medical records are retained as required by applicable healthcare regulations (typically **5–7 years** under Indian medical record retention guidelines), even if I deactivate my account.

### 6. My rights

I may at any time:
- **Access** a copy of my data
- **Correct** inaccurate personal information
- **Withdraw** this consent (which will end my active use of the Platform)
- **Restrict** how my data is used
- **Port** my data to another healthcare provider
- **Lodge a complaint** with the relevant data protection authority

To exercise any right, I will contact my registering clinic.

### 7. Sharing with third parties

My identifiable data will **not** be shared with third parties except: (a) as required by law, (b) with my separate written consent, (c) with trusted infrastructure providers strictly to operate the Platform under confidentiality agreements, or (d) in a medical emergency.

### 8. Research

Standard registration does **not** consent to research use of my data. Any research participation requires separate, specific written consent.

---

### Patient — Required Tick-box Acknowledgments

> The following four boxes must each be ticked before the **"Submit Registration"** button is enabled.

- [ ] **I have read and understood** the information above.
- [ ] **I consent** to the collection, storage, and processing of my personal and health information for the purposes described.
- [ ] **I confirm** I am at least 18 years old, or my parent/legal guardian is providing consent on my behalf.
- [ ] **I understand** I can withdraw this consent at any time by contacting my clinic, subject to medical-record retention requirements.

**Optional acknowledgment (separate, unbundled):**

- [ ] I consent to my **anonymized** data being used for service improvement and clinical analytics. *(Optional — declining will not affect my care.)*

---

## B. Doctor Consent (shown at first login after admin-issued credentials)

By logging in to the **NeuroWellness Platform** with the credentials provided by my clinic administrator, I acknowledge and agree to the following:

### 1. Information collected about me

The Platform stores: my full name, professional email, phone, city/state, specialization, license number, hospital affiliation, years of experience, clinic affiliation, qualifications, languages spoken, availability status, and patient load.

### 2. Information I will access

In the course of providing care, I will access **patient health information** — including identity, medical history, assessment responses, scale scores, and clinical notes — for patients at my registering clinic who are allocated to me or whom I am authorized to consult on.

### 3. My obligations as a Platform user

I agree to:

- **Confidentiality** — treat all patient information as strictly confidential and only access it on a clinical, need-to-know basis
- **Lawful use** — use the Platform only for legitimate clinical purposes, in compliance with my professional medical regulations (MCI / NMC) and the Digital Personal Data Protection Act, 2023
- **Account security** — keep my login credentials private, log out from shared devices, change my temporary password on first login, and notify my admin immediately of any suspected unauthorized access
- **Accurate clinical documentation** — record assessment grants, diagnoses, and treatment decisions accurately and promptly
- **No data export** — not download, screenshot, or share patient data outside the Platform except through authorized clinical workflows
- **Audit trail** — accept that all my actions on the Platform are logged for audit and compliance purposes

### 4. My professional consent

I confirm that I am a **licensed medical practitioner** (or other qualified clinician) authorized to practice in India, and I will operate within my scope of practice. My license details will be visible to my clinic administrator and authorized regulatory parties on request.

### 5. Information about me visible to others

My name, specialization, availability status, and aggregate patient load will be visible to other authorized staff at my clinic. My identity and specialization may also be visible to patients allocated to my care.

### 6. My rights as a user

I may at any time:
- **Update** my professional profile and availability
- **Request** a copy of the data the Platform holds about me
- **Request deactivation** of my account through my clinic administrator (subject to record-retention obligations for any patient care I have already provided)

---

### Doctor — Required Tick-box Acknowledgments

> The following four boxes must each be ticked before access to clinical features is enabled.

- [ ] **I have read and understood** the information above, including my obligations as a clinical user.
- [ ] **I agree** to maintain the confidentiality of all patient information and to use the Platform only for legitimate clinical purposes.
- [ ] **I confirm** I am a licensed medical practitioner and the professional details provided are accurate.
- [ ] **I acknowledge** that my actions on the Platform are logged for audit and compliance purposes.

---

## C. Implementation Notes (for development team)

This section is for the engineering team only — not shown to end users.

### Where this is rendered

| Role | Trigger | Component |
|------|---------|-----------|
| Patient (self-registration) | Final step of `/register` form | Modal or inline section before submit button |
| Patient (staff-registered) | First login after receptionist creates account | Full-screen overlay on first authenticated session |
| Doctor / Clinical Assistant / Receptionist | First login after admin issues credentials | Full-screen overlay; blocks access until accepted |

### What to record

When the user submits, capture a consent record with the following fields:

| Field | Source |
|-------|--------|
| `user_id` | The user's profile id |
| `consent_type` | `"patient_data_privacy"` or `"doctor_data_privacy"` |
| `consent_version` | `"v1.0"` (matches this document) |
| `accepted_required` | boolean array — must all be true to proceed |
| `accepted_optional` | boolean array — analytics opt-in for patients |
| `accepted_at` | server timestamp |
| `ip_address` | request IP |
| `user_agent` | browser/device |

### Suggested DB schema

```sql
CREATE TABLE IF NOT EXISTS user_consents (
  consent_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  consent_type     TEXT NOT NULL CHECK (consent_type IN ('patient_data_privacy', 'doctor_data_privacy', 'analytics_optional')),
  consent_version  TEXT NOT NULL,
  accepted         BOOLEAN NOT NULL,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address       INET,
  user_agent       TEXT,
  UNIQUE (user_id, consent_type, consent_version)
);

CREATE INDEX idx_user_consents_user ON user_consents(user_id);
```

### Backend endpoint to add

`POST /users/me/consent` — accepts:
```json
{
  "consent_type": "patient_data_privacy",
  "consent_version": "v1.0",
  "accepted": true,
  "optional_accepted": { "analytics": false }
}
```

Returns 201 and writes one row per consent type. Patient self-registration should call this **inside** the same transaction as patient creation, so a partial registration cannot leave a user without a consent record.

### Re-consent

When this document's version is incremented (v1.0 → v1.1), affected users will see the updated consent on their next login. The application checks for a current-version consent row before allowing access to clinical features. Old consents are retained as a historical audit trail.

### Frontend integration

- Submit button disabled until all required checkboxes are ticked
- Show consent version and accepted timestamp on user's profile page under "Privacy & Consent"
- "View my consents" link in profile settings — calls `GET /users/me/consents` and renders the list

---

*This consent is operated by the registering clinic. The Platform technology is operated by Sozo. For data protection enquiries, contact the registering clinic's Data Protection Officer.*

**Document owner:** Clinical Operations, NeuroWellness Clinic  
**Last updated:** 2026-05-07
