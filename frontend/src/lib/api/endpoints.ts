export const ENDPOINTS = {
  // ─── Auth ───
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    ME: "/auth/login",        // GET /auth/login returns current user
    SYNC_PROFILE: "/auth/sync-profile",
    CLINICS: "/auth/clinics", // GET — list available clinics for registration
  },

  // ─── Consent ───
  CONSENT: {
    FORMS: "/consent/forms",       // GET — public, no auth
    RESPONSES: "/consent/responses", // POST — public, no auth
  },

  // ─── Users ───
  USERS: {
    PROFILE: "/users/me",
  },

  // ─── Doctors ───
  DOCTORS: {
    DASHBOARD: "/doctors/dashboard",
    PATIENTS: "/doctors/patients",
    PATIENT: (patientId: string) => `/doctors/patients/${patientId}`,
    PATIENT_RESULTS: (patientId: string) => `/doctors/patients/${patientId}/results`,
    PATIENT_RESULT: (patientId: string, instanceId: string) =>
      `/doctors/patients/${patientId}/results?instance_id=${encodeURIComponent(instanceId)}`,
    GRANT_ASSESSMENT: (patientId: string) => `/doctors/patients/${patientId}/grant-assessment`,
    AVAILABILITY: "/doctors/availability",
  },

  // ─── Patients ───
  PATIENTS: {
    DASHBOARD: "/patients/dashboard",
    MY_DOCTOR: "/patients/my-doctor",
    MY_ASSESSMENTS: "/patients/my-assessments",
    MY_SCORES: "/patients/my-scores",
  },

  // ─── Staff ───
  STAFF: {
    DASHBOARD: "/staff/dashboard",
    PATIENTS: "/staff/patients",
    PATIENTS_PENDING: "/staff/patients/pending",
    REGISTER_PATIENT: "/staff/patients/register",
    PATIENT: (patientId: string) => `/staff/patients/${patientId}`,
    APPROVE_PATIENT: (patientId: string) => `/staff/patients/${patientId}/approve`,
    REJECT_PATIENT: (patientId: string) => `/staff/patients/${patientId}/reject`,
    DOCTORS: "/staff/doctors",
    ALLOCATE: (patientId: string) => `/staff/patients/${patientId}/allocate`,
  },

  // ─── Admin ───
  ADMIN: {
    CLINICS_BOOTSTRAP: "/admin/clinics/create", // POST — X-Bootstrap-Key header required
    DASHBOARD: "/admin/dashboard",
    CLINICS: "/admin/clinics",
    CLINIC: (id: string) => `/admin/clinics/${id}`,
    DEACTIVATE_CLINIC: (id: string) => `/admin/clinics/${id}/deactivate`,
    ACTIVATE_CLINIC: (id: string) => `/admin/clinics/${id}/activate`,
    STAFF: "/admin/staff",
    STAFF_MEMBER: (id: string) => `/admin/staff/${id}`,
    REGISTER_STAFF: "/admin/staff/register",
    DEACTIVATE_STAFF: (id: string) => `/admin/staff/${id}/deactivate`,
    REACTIVATE_STAFF: (id: string) => `/admin/staff/${id}/reactivate`,
    DELETE_STAFF: (id: string) => `/admin/staff/${id}`,
    PATIENTS: "/admin/patients",
    APPROVE_PATIENT: (id: string) => `/admin/patients/${id}/approve`,
    REJECT_PATIENT: (id: string) => `/admin/patients/${id}/reject`,
    DELETE_PATIENT: (id: string) => `/admin/patients/${id}`,
  },

  // ─── Notifications ───
  NOTIFICATIONS: {
    LIST: "/notifications/",
    READ_ALL: "/notifications/read-all",
    READ: (id: string) => `/notifications/${id}/read`,
  },

  // ─── PRS ───
  PRS: {
    // Scales
    SCALES: "/prs/scales/",
    SCALE: (id: string) => `/prs/scales/${id}`,
    SCALE_BY_CODE: (code: string) => `/prs/scales/by-code/${code}`,
    // Conditions
    CONDITIONS: "/prs/conditions/",
    CONDITION: (id: string) => `/prs/conditions/${encodeURIComponent(id)}`,
    // Questions
    QUESTION_OPTIONS: (questionId: string) => `/prs/questions/${questionId}/options`,
    // Permissions
    PERMISSIONS: "/prs/permissions/",
    MY_PERMISSIONS: "/prs/permissions/my",
    PATIENT_PERMISSIONS: (patientId: string) => `/prs/permissions/patient/${patientId}`,
    REVOKE_PERMISSION: (permissionId: string) => `/prs/permissions/${permissionId}/revoke`,
    // Assessment
    ASSESSMENT_START: "/prs/assessment/start",
    ASSESSMENT_SUBMIT: "/prs/assessment/submit",
    ASSESSMENT_SAVE_RESPONSE: "/prs/assessment/save-response",
    ASSESSMENT_RESPONSES: (instanceId: string) =>
      `/prs/assessment/responses?instance_id=${encodeURIComponent(instanceId)}`,
    // Scores
    MY_SCORES: "/prs/scores/me",
    MY_SCORES_SUMMARY: "/prs/scores/me/summary",
    INSTANCE_SCORE: (instanceId: string) => `/prs/scores/instance/${instanceId}`,
    PATIENT_SCORES: (patientId: string) => `/prs/scores/patient/${patientId}`,
    PATIENT_SCORES_SUMMARY: (patientId: string) => `/prs/scores/patient/${patientId}/summary`,
    // Sessions
    SESSIONS: "/prs/sessions/",
    MY_SESSIONS: "/prs/sessions/my",
    PATIENT_SESSIONS: (patientId: string) => `/prs/sessions/patient/${patientId}`,
    SESSION: (sessionId: string) => `/prs/sessions/${sessionId}`,
    START_SESSION: (sessionId: string) => `/prs/sessions/${sessionId}/start`,
    CANCEL_SESSION: (sessionId: string) => `/prs/sessions/${sessionId}/cancel`,
    // Responses
    AUTO_SAVE: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/scales/${scaleId}/auto-save`,
    SUBMIT_RESPONSE: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/scales/${scaleId}/submit`,
    CLINICIAN_RATING: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/scales/${scaleId}/clinician-rating`,
    // Consent
    CONSENT: (sessionId: string) => `/prs/sessions/${sessionId}/consent`,
    // Alerts
    MY_ALERTS: "/prs/alerts/my",
    PATIENT_ALERTS: (patientId: string) => `/prs/alerts/patient/${patientId}`,
    ACKNOWLEDGE_ALERT: (alertId: string) => `/prs/alerts/${alertId}/acknowledge`,
    RESOLVE_ALERT: (alertId: string) => `/prs/alerts/${alertId}/resolve`,
    // Score history
    SCORE_HISTORY: (patientId: string) => `/prs/scores/patient/${patientId}/history`,
  },

  // ─── Anamnesis ───
  ANAMNESIS: {
    QUESTIONS:     "/anamnesis/questions",
    START:         "/anamnesis/start",
    SAVE_RESPONSE: "/anamnesis/save-response",
    SUBMIT:        "/anamnesis/submit",
    ME:            "/anamnesis/me",
    FOR_PATIENT:   (patientId: string) => `/anamnesis/patient/${patientId}`,
  },

  // ─── Schedule ───
  SCHEDULE: {
    MY:            "/schedule/my",
    ADD_OVERRIDE:  "/schedule/my/overrides",
    DELETE_OVERRIDE: (id: string) => `/schedule/my/overrides/${id}`,
    SLOTS:         (doctorId: string) => `/schedule/doctor/${doctorId}/slots`,
    DOCTOR:        (doctorId: string) => `/schedule/doctor/${doctorId}`,
  },

  // ─── Appointments ───
  APPOINTMENTS: {
    LIST:               "/appointments",
    UPCOMING:           "/appointments/upcoming",
    TODAY:              "/appointments/today",
    GET:                (id: string) => `/appointments/${id}`,
    UPDATE:             (id: string) => `/appointments/${id}`,
    HISTORY:            (id: string) => `/appointments/${id}/history`,
    CONFIRM:            (id: string) => `/appointments/${id}/confirm`,
    CHECK_IN:           (id: string) => `/appointments/${id}/check-in`,
    START:              (id: string) => `/appointments/${id}/start`,
    COMPLETE:           (id: string) => `/appointments/${id}/complete`,
    CANCEL:             (id: string) => `/appointments/${id}/cancel`,
    RESCHEDULE:         (id: string) => `/appointments/${id}/reschedule`,
    NO_SHOW:            (id: string) => `/appointments/${id}/no-show`,
    REQUEST_RESCHEDULE: (id: string) => `/appointments/${id}/request-reschedule`,
  },

  // ─── Appointment Requests ───
  APPOINTMENT_REQUESTS: {
    LIST:    "/appointment-requests",
    CREATE:  "/appointment-requests",
    GET:     (id: string) => `/appointment-requests/${id}`,
    APPROVE: (id: string) => `/appointment-requests/${id}/approve`,
    REJECT:  (id: string) => `/appointment-requests/${id}/reject`,
    CANCEL:  (id: string) => `/appointment-requests/${id}/cancel`,
  },

  // ─── Doctor Notes ───
  DOCTOR_NOTES: {
    FOR_PATIENT: (patientId: string) => `/doctor-notes/patient/${patientId}`,
    ME: "/doctor-notes/me",
    UPSERT: (patientId: string) => `/doctor-notes/patient/${patientId}`, // PUT
  },

  // ─── EEG Reports ───
  EEG: {
    UPLOAD: "/eeg/reports/upload",
    REPORT: (reportId: string) => `/eeg/reports/${reportId}`,
    DOWNLOAD: (reportId: string) => `/eeg/reports/${reportId}/download`,
    PATIENT_REPORTS: (patientId: string) => `/eeg/reports/patient/${patientId}/reports`,
    DELETE: (reportId: string) => `/eeg/reports/${reportId}`,
    // EEG analysis pipeline (.nedf / .edf) — served by brain_mapping service (NEXT_PUBLIC_BRAIN_MAPPING_URL)
    ANALYZE: "/analyze",
    ANALYSIS_STATUS: (jobId: string) => `/status/${jobId}`,
    ANALYSIS_DOWNLOAD: (jobId: string, filename: string) => `/download/${jobId}/${filename}`,
  },
} as const;
