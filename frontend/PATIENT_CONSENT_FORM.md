# Patient Registration & Treatment Consent Form

**NeuroWellness Clinic — Digital Health Platform**

---

**Patient Reference:**

| Field | Value |
|-------|-------|
| Patient Full Name | _________________________________________ |
| Date of Birth | ________ / ________ / __________ |
| Gender | ☐ Male ☐ Female ☐ Other ☐ Prefer not to say |
| Email Address | _________________________________________ |
| Phone Number | _________________________________________ |
| Medical Record Number (MRN) | _________________________________________ |
| Registering Clinic | _________________________________________ |
| Date of Registration | ________ / ________ / __________ |

---

## Section 1 — Introduction & Purpose

I, the undersigned, am registering as a patient with **NeuroWellness Clinic** ("the Clinic") and its digital health platform ("the Platform") for the purpose of receiving clinical neurological assessment, consultation, and ongoing care.

I understand that this consent form covers:

1. **Registration** with the Clinic and creation of my digital health record
2. **Collection, storage, and processing** of my personal and medical information
3. **Clinical assessment** through standardized scales administered via the Platform's PRS (Patient Rating Scale) engine
4. **Care delivery**, including allocation to a treating doctor and scheduling of clinical sessions
5. **Communication** with me through email, phone, or in-platform notifications

I confirm that I am at least 18 years of age, or that this consent is being provided by my legal guardian on my behalf.

---

## Section 2 — Information We Collect and Why

The Clinic will collect, process, and store the following categories of my information for the purposes stated below. I understand each category and the reason it is collected.

### 2.1 Identity & Contact Information

**What is collected:** Full name, date of birth, gender, email address, phone number, residential city, state, country, address, and emergency contact details.

**Why:** To uniquely identify me as a patient, contact me about my appointments and care, and contact a designated person on my behalf in case of a medical emergency.

**Stored in:** `profiles` and `patients` tables on the Platform.

☐ **I consent to the collection and use of this information.**

---

### 2.2 Medical & Clinical Information

**What is collected:** My medical history, current medications, known allergies, blood group, past surgical operations, previous neurological treatments, brain imaging history (e.g., MRI), neuromodulation history, chief complaint, presenting symptoms (onset, duration, frequency, intensity, progression), and any secondary symptoms.

**Why:** To enable my treating doctor and clinical team to provide accurate diagnosis, safe treatment, and personalized care. This information forms my **Electronic Medical Record (EMR)**.

**Stored in:** `patients`, `anamnesis_assessments`, and related clinical tables.

☐ **I consent to the collection and use of this clinical information.**

---

### 2.3 Assessment Data (PRS — Patient Rating Scales)

**What is collected:** My responses to standardized clinical assessment questionnaires across one or more of the 14 supported neurological conditions, including (but not limited to) Parkinson's Disease, Alzheimer's Disease, Stroke, Multiple Sclerosis, Epilepsy, Migraine, Anxiety Disorders, Depression, and others. Each assessment uses validated clinical scales (e.g., UPDRS, MoCA, MMSE, MDS-UPDRS, HAM-D, HAM-A, etc.).

**Why:** To objectively measure the severity, type, and progression of my neurological condition; to track my response to treatment; and to support clinical decision-making by my doctor.

**Stored in:** `prs_assessment_instances`, `prs_responses`, `prs_scale_results`, `prs_final_results` tables.

☐ **I consent to the administration of clinical assessments and the storage of my assessment responses.**

---

### 2.4 Account & Authentication Data

**What is collected:** A login email address and password (encrypted), session tokens, login timestamps, and access device/IP information.

**Why:** To securely identify me each time I access the Platform and prevent unauthorized access to my health record.

**Stored in:** Supabase Auth service (encrypted at rest).

☐ **I consent to the creation of a secure login account on the Platform.**

---

## Section 3 — How My Information Is Used

I understand that my information will be used by the Clinic and authorized Platform users for the following purposes:

### 3.1 Clinical Care

- Diagnosis, treatment planning, and ongoing care by my **assigned treating doctor**
- Review of my case by **clinical assistants** who support my treating doctor in administering assessments
- Coordination of my appointments and follow-ups by the **clinic receptionist**

### 3.2 Doctor Allocation

I understand that upon approval of my registration, the Platform will **automatically allocate me to a doctor** at my registering clinic based on the following criteria, in order:
1. A doctor practicing in my city
2. If unavailable, a doctor practicing in my state
3. If unavailable, any available doctor at my clinic with capacity

The allocated doctor may be changed by the receptionist or admin if clinically appropriate. I will be informed of the doctor assigned to my care.

### 3.3 Approval Process

I understand that my registration is **subject to approval by the clinic receptionist or administrator** before my account becomes active. I will receive a notification once my account is approved. If my registration is **rejected**, I will receive a notification with the reason, and my data will be retained in accordance with applicable medical record retention regulations.

### 3.4 Communication

I consent to being contacted by the Clinic and Platform via:
- ☐ Email (registration confirmation, appointment reminders, results notifications, account updates)
- ☐ Phone or SMS (urgent matters, appointment changes)
- ☐ In-platform notifications

I may opt out of non-essential communications at any time by contacting the Clinic.

### 3.5 Analytics & Service Improvement

The Clinic may use **anonymized and aggregated** data from my assessments and care episodes to:
- Improve clinical assessment accuracy
- Identify patterns across patient populations
- Support medical research (only with separate explicit consent)

I understand that anonymized data **cannot be linked back to my identity**.

☐ **I consent to the use of my anonymized data for service improvement and analytics.**

---

## Section 4 — Who Can Access My Information

The following authorized personnel will have role-based access to my information through the Platform:

| Role | What They Can See |
|------|-------------------|
| **My Treating Doctor** | Full medical record, all assessment results, anamnesis, sessions |
| **Clinical Assistant (at my clinic)** | Assessment data and clinical notes, but cannot grant new assessments or modify diagnoses |
| **Receptionist (at my clinic)** | Demographic and registration information; can approve, allocate, and schedule but cannot view detailed clinical results |
| **Clinic Administrator** | Operational and administrative data; can manage staff and clinic settings |
| **Platform Administrator (Sozo)** | Technical access for platform operation only — does not access individual clinical data in the normal course of business |

I understand that:

- All access is **logged in the system audit trail**
- My data is **isolated to my registering clinic** — other clinics on the Platform cannot see my information
- Access is enforced both at the **application level** and the **database level** through Row-Level Security policies

---

## Section 5 — Data Storage, Security & Retention

### 5.1 Storage

My data will be stored on **Supabase** infrastructure (PostgreSQL database hosted on secure cloud servers). The Platform follows industry-standard security practices including:

- Encrypted storage at rest
- Encrypted transmission (HTTPS/TLS) in transit
- Role-based access controls
- JWT-based authentication with token rotation
- Regular security audits

### 5.2 Retention

The Clinic will retain my medical records in accordance with **applicable healthcare regulations** (including, where applicable, the Digital Personal Data Protection Act, 2023 and relevant Indian medical record retention guidelines), which generally require retention of medical records for a minimum of **5 to 7 years** after the date of last consultation, or longer for minors or specific conditions.

If I request deletion of my account, my **identifying information** may be anonymized, but my clinical assessment data will be retained as a de-identified record in compliance with retention requirements.

### 5.3 Rejection of Registration

If my registration is rejected by the clinic, my account will be deactivated. Any clinical data collected during the registration process (such as initial medical history) will be retained per the retention policy unless I formally request deletion.

---

## Section 6 — My Rights

I understand that I have the following rights regarding my information:

### 6.1 Right to Access

I may request a copy of my personal and clinical data held by the Clinic at any time, free of charge, by contacting the Clinic. I can also view most of my data directly through my patient portal on the Platform.

### 6.2 Right to Correct

I may request correction of any inaccurate personal information. Clinical assessment results (once recorded) cannot be edited but can be supplemented with corrected entries by my treating doctor.

### 6.3 Right to Withdraw Consent

I may withdraw my consent at any time by submitting a written request to the Clinic. Withdrawal of consent:
- Will end my active participation in the Platform
- Will not affect the legality of processing performed before withdrawal
- Does not require the Clinic to delete records that must be retained by law

### 6.4 Right to Restrict Processing

I may request that the Clinic limit the use of my data to specific purposes (e.g., care delivery only, no analytics).

### 6.5 Right to Data Portability

I may request my clinical record in a structured, machine-readable format to share with another healthcare provider.

### 6.6 Right to Lodge a Complaint

I may lodge a complaint with the appropriate data protection authority if I believe my rights have been violated.

---

## Section 7 — Treatment Consent

In addition to consent for data handling, I provide the following consents related to the clinical care I will receive:

### 7.1 Consent to Clinical Assessment

☐ I consent to being assessed through standardized clinical scales administered by my treating doctor or clinical assistant via the Platform. I understand these assessments are part of routine clinical practice and not experimental.

### 7.2 Consent to Treatment Planning

☐ I consent to my assigned doctor reviewing my information, formulating a clinical opinion, and recommending a course of treatment based on my assessment results and medical history.

### 7.3 Consent to Reassignment

☐ I consent to being reassigned to a different doctor within my clinic if my originally allocated doctor becomes unavailable, if I request a change, or if the clinic determines it is clinically appropriate.

### 7.4 Acknowledgment of Limitations

I acknowledge and understand that:
- The Platform is a **clinical decision support tool** and does not replace clinical judgment
- The Platform does not provide **emergency medical services** — for emergencies I must contact local emergency services (102 / 108 in India, or visit the nearest hospital)
- Assessment results provide **objective measurements** but final diagnosis and treatment decisions remain with my treating doctor
- Telehealth or digital consultations have inherent limitations compared to in-person evaluation

---

## Section 8 — Special Categories

### 8.1 Minor Patients (Under 18)

If the patient is under 18 years of age, this consent must be provided by the patient's **parent or legal guardian**, who confirms their legal authority to consent on behalf of the minor.

☐ I am the parent/legal guardian of the patient and consent on their behalf.  
Guardian Name: ___________________________ Relationship: ___________________________

### 8.2 Patients Unable to Consent

If the patient lacks the capacity to provide informed consent (due to medical, cognitive, or other reasons), this consent must be provided by the patient's **legally authorized representative**.

☐ I am the legally authorized representative of the patient.  
Representative Name: ___________________________ Authority/Relationship: ___________________________

### 8.3 Research Participation

I understand that **separate, specific written consent** will be required before my data is used for any research purpose, including clinical trials or publication. Standard registration does **not** include consent to research.

---

## Section 9 — Sharing With Third Parties

The Clinic will **not** share my identifiable information with third parties except in the following circumstances:

1. **As required by law** (e.g., notifiable diseases reporting, court order, regulatory audit)
2. **With my explicit written consent** (e.g., sharing with another doctor or clinic I designate)
3. **With trusted service providers** that support Platform operation (e.g., Supabase as the database provider, transactional email service for notifications) — all bound by confidentiality and data processing agreements
4. **In a medical emergency**, where sharing essential information with emergency responders is in my vital interest

I will not be subject to **marketing communications from third parties** based on my health data.

---

## Section 10 — Changes to This Consent

The Clinic may update this consent form periodically to reflect changes in regulation, clinical practice, or Platform functionality. I will be **notified of material changes** and may be asked to re-consent. Continued use of the Platform after a notified change indicates acceptance of the updated terms.

---

## Section 11 — Declaration & Signature

I confirm that:

☐ I have **read and understood** this entire consent form  
☐ I have had the opportunity to **ask questions** and have those questions answered to my satisfaction  
☐ I am **at least 18 years old**, or this consent is being signed by my legal guardian/representative  
☐ I am providing this consent **voluntarily**, free from coercion  
☐ I understand I can **withdraw consent** at any time, subject to clinical record retention requirements  
☐ I confirm that all information I have provided is **accurate and complete** to the best of my knowledge

---

### Patient / Guardian Signature

| | |
|--|--|
| **Patient Name (printed):** | ____________________________________________ |
| **Signature:** | ____________________________________________ |
| **Date:** | ________ / ________ / __________ |
| **Place:** | ____________________________________________ |

---

### Witness (Clinic Staff)

| | |
|--|--|
| **Witness Name (printed):** | ____________________________________________ |
| **Role:** | ☐ Receptionist ☐ Clinical Assistant ☐ Doctor |
| **Employee ID:** | ____________________________________________ |
| **Clinic:** | ____________________________________________ |
| **Signature:** | ____________________________________________ |
| **Date:** | ________ / ________ / __________ |

---

### Digital Consent (for online/self-registration patients)

If signing electronically through the Platform during self-registration:

| Field | Value |
|-------|-------|
| Consent recorded on (timestamp): | ____________________________________________ |
| Consent IP address: | ____________________________________________ |
| Consent version: | v1.0 — 2026-05-07 |
| Recorded by system: | NeuroWellness Platform (`prs-neurowellness` v[release]) |

---

## Appendix A — Glossary

| Term | Meaning |
|------|---------|
| **Platform** | The NeuroWellness digital health platform, including the patient-facing application (`prs-neurowellness`) and the backend system (`neurowellness-backend-v1`) |
| **PRS** | Patient Rating Scales — the suite of validated clinical assessment instruments administered through the Platform |
| **EMR** | Electronic Medical Record — my complete digital health record on the Platform |
| **Anamnesis** | A structured clinical interview / intake form completed once, documenting medical and symptom history |
| **MRN** | Medical Record Number — a unique identifier assigned to me by the Clinic |
| **Treating Doctor** | The doctor allocated to my care by the Clinic |
| **Clinic** | The specific NeuroWellness Clinic at which I am registered |
| **Sozo / Platform Administrator** | The organization that operates the Platform technology |

---

## Appendix B — Contact for Privacy & Data Concerns

For questions about this consent, my data, or to exercise my rights:

| | |
|--|--|
| **Clinic Contact:** | _________________________________________ |
| **Clinic Email:** | _________________________________________ |
| **Clinic Phone:** | _________________________________________ |
| **Clinic Address:** | _________________________________________ |
| **Data Protection Officer (Platform):** | _________________________________________ |

---

*This document constitutes the patient's informed consent for registration and treatment with the Clinic via the NeuroWellness Platform. A signed copy will be retained in the patient's clinical record. A copy will be provided to the patient on request.*

**Document version:** v1.0  
**Effective date:** 2026-05-07  
**Document owner:** Clinical Operations, NeuroWellness Clinic
