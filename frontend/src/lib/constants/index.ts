export const USER_ROLES = {
  PATIENT: "patient",
  DOCTOR: "doctor",
  CLINICAL_ASSISTANT: "clinical_assistant",
  RECEPTIONIST: "receptionist",
  PLATFORM_ADMIN: "platform_admin",
  CLINICAL_ADMIN: "clinical_admin",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  patient: "Patient",
  doctor: "Doctor",
  clinical_assistant: "Clinical Assistant",
  platform_admin: "Platform Admin",
  clinical_admin: "Clinical Admin",
};

export const SESSION_STATUS = {
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export const ALERT_SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

export const ROUTES = {
  LOGIN: "/login",
  REGISTER: "/register",
  PATIENT_DASHBOARD: "/patient/dashboard",
  DOCTOR_DASHBOARD: "/doctor/dashboard",
  CA_DASHBOARD: "/clinical-assistant/dashboard",
  RECEPTIONIST_DASHBOARD: "/receptionist/dashboard",
  ADMIN_DASHBOARD: "/admin/dashboard",
} as const;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: "prs_access_token",
  REFRESH_TOKEN: "prs_refresh_token",
  USER: "prs_user",
} as const;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
