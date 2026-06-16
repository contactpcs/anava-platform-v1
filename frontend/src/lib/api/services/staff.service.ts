import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { StaffDashboard, PatientListItem, PatientDetail, DoctorListItem } from "@/types/domain.types";
import type { ConsentResponseItem } from "@/types/auth.types";

export interface RegisterPatientPayload {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  city: string;
  state: string;
  country?: string;
  consent_responses?: ConsentResponseItem[];
}

// ─── Normalization helpers ────────────────────────────────────────────────────

function normalizePatient(raw: any): PatientListItem {
  // GET /staff/patients returns profiles as a nested object; pending/detail flatten them
  const p = raw?.profiles ?? {};

  const fullName = (
    raw?.full_name      ||
    p?.full_name        ||
    raw?.user?.full_name ||
    ""
  ).trim();

  const parts = fullName.split(/\s+/);
  const first = raw?.first_name || p?.first_name || parts[0]                || "";
  const last  = raw?.last_name  || p?.last_name  || parts.slice(1).join(" ") || "";

  return {
    id:            raw?.id        || raw?.patient_id                              || "",
    full_name:     fullName       || `${first} ${last}`.trim(),
    first_name:    first,
    last_name:     last,
    email:         raw?.email     || p?.email     || raw?.user?.email             || "",
    phone:         raw?.phone     || p?.phone     || undefined,
    mrn:           raw?.mrn                                                       || undefined,
    date_of_birth: raw?.date_of_birth || p?.date_of_birth || raw?.dob            || undefined,
    gender:        raw?.gender    || p?.gender                                    || undefined,
    condition:     raw?.condition                                                 || undefined,
    status:        raw?.approval_status || raw?.status || raw?.account_status    || undefined,
    assigned_at:   raw?.assigned_at                                               || undefined,
    registered_at: raw?.registered_at  || raw?.created_at                        || undefined,
    created_at:    raw?.created_at                                                || undefined,
    clinic_id:     raw?.clinic_id || p?.clinic_id                                || undefined,
    clinic_name:   raw?.clinic_name                                               || undefined,
    clinic_city:   raw?.clinic_city || raw?.city  || p?.city                     || undefined,
    last_prs:      raw?.last_prs                                                  || null,
  };
}

/** Unwrap any server envelope and return a plain array of raw patient objects. */
function extractList(data: any): any[] {
  const payload = data?.data ?? data;
  if (Array.isArray(payload)) return payload;
  // common envelope keys
  for (const key of ["patients", "items", "results", "data", "list"]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const staffService = {
  async getDashboard(): Promise<StaffDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.DASHBOARD);
    const payload = data?.data ?? data;
    const summary = payload?.patients_summary ?? {};
    return {
      patient_count:   summary?.total             ?? payload?.patient_count   ?? 0,
      pending_count:   summary?.pending_approval  ?? payload?.pending_count   ?? 0,
      registered_today: summary?.registered_today ?? payload?.registered_today ?? 0,
      upcoming_sessions: payload?.upcoming_sessions ?? [],
      recent_scores:   payload?.recent_scores ?? [],
    };
  },

  async getPatients(params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS, { params });
    const raw = extractList(data);
    const payload = data?.data ?? data;
    const meta = data?.meta ?? payload?.meta;
    return {
      patients: raw.map(normalizePatient),
      total: meta?.total ?? payload?.total ?? raw.length,
    };
  },

  async getPendingPatients(params?: { page?: number; limit?: number }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS_PENDING, { params });
    const raw = extractList(data);
    const payload = data?.data ?? data;
    const meta = data?.meta ?? payload?.meta;
    return {
      patients: raw.map(normalizePatient),
      total: meta?.total ?? payload?.total ?? raw.length,
    };
  },

  async registerPatient(payload: RegisterPatientPayload): Promise<PatientListItem> {
    const { data } = await apiClient.post(ENDPOINTS.STAFF.REGISTER_PATIENT, payload);
    return normalizePatient(data.data ?? data);
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENT(patientId));
    const payload = data.data ?? data;
    const rawPatient = payload.patient ?? payload;
    const normalized = normalizePatient(rawPatient) as PatientDetail;
    // Preserve fields the list-shape normalizer drops (medical/clinical context).
    normalized.medical_history   = rawPatient?.medical_history   ?? undefined;
    normalized.emergency_contact = rawPatient?.emergency_contact ?? undefined;
    normalized.blood_group       = rawPatient?.blood_group       ?? undefined;
    normalized.recent_sessions   = payload.recent_sessions ?? [];
    return normalized;
  },

  async approvePatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.put(ENDPOINTS.STAFF.APPROVE_PATIENT(patientId));
    return data.data ?? data;
  },

  async rejectPatient(patientId: string, reason?: string): Promise<PatientDetail> {
    const { data } = await apiClient.put(ENDPOINTS.STAFF.REJECT_PATIENT(patientId), { reason });
    return data.data ?? data;
  },

  async getDoctors(): Promise<{ doctors: DoctorListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.DOCTORS);
    const payload = data.data ?? data;
    const list: any[] = Array.isArray(payload) ? payload : (payload.doctors ?? []);
    return {
      doctors: list.map((d: any) => {
        const fullName = d?.full_name || `${d?.first_name || ""} ${d?.last_name || ""}`.trim();
        const parts = fullName.split(/\s+/);
        return {
          id:                  d?.id || d?.user_id || "",
          first_name:          d?.first_name  || d?.firstName  || parts[0] || "",
          last_name:           d?.last_name   || d?.lastName   || parts.slice(1).join(" ") || "",
          specialization:      d?.specialization || undefined,
          availability_status: (d?.availability_status || d?.availability || "available") as "available" | "unavailable",
          patient_count:       d?.current_patient_count ?? d?.patient_count ?? 0,
          phone:               d?.phone || undefined,
        };
      }),
      total: payload?.total ?? list.length,
    };
  },

  async allocatePatient(patientId: string, doctorId: string): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.STAFF.ALLOCATE(patientId), { doctor_id: doctorId });
    return data.data ?? data;
  },
};
