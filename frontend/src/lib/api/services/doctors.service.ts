import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DoctorDashboard, PatientListItem, PatientDetail } from "@/types/domain.types";
import type { InstanceScoreDetail } from "./scores.service";

export const doctorsService = {
  async getDashboard(): Promise<DoctorDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.DASHBOARD);
    return data.data ?? data;
  },

  async getPatients(params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENTS, { params });
    const rawList: unknown[] = data.data ?? [];
    const total: number = (data.meta as Record<string, number> | undefined)?.total ?? rawList.length;
    const patients = rawList.map((item) => {
      const p = item as Record<string, unknown>;
      const profile = (p.profiles as Record<string, unknown>) ?? {};
      const fullName = (profile.full_name as string) ?? "";
      const parts = fullName.trim().split(/\s+/);
      return {
        id: p.id as string,
        full_name: fullName,
        first_name: parts[0] ?? "",
        last_name: parts.slice(1).join(" "),
        email: (profile.email as string) ?? "",
        phone: (profile.phone as string) ?? undefined,
        mrn: (p.mrn as string) ?? undefined,
        date_of_birth: (profile.date_of_birth as string) ?? undefined,
        gender: (profile.gender as string) ?? undefined,
        status: (p.status as string) ?? undefined,
        last_prs: (p.last_prs as PatientListItem["last_prs"]) ?? null,
      } as PatientListItem;
    });
    return { patients, total };
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(patientId));
    const payload = data.data ?? data;
    return payload.patient ?? payload;
  },

  async getPatientResult(patientId: string, instanceId: string): Promise<InstanceScoreDetail> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT_RESULT(patientId, instanceId));
    return data.data ?? data;
  },

  async grantAssessment(patientId: string, payload: { disease_id: string; scale_ids?: string[] }): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.DOCTORS.GRANT_ASSESSMENT(patientId), payload);
    return data.data ?? data;
  },

  async updateAvailability(status: "available" | "unavailable"): Promise<unknown> {
    const { data } = await apiClient.put(ENDPOINTS.DOCTORS.AVAILABILITY, { availability_status: status });
    return data.data ?? data;
  },
};
