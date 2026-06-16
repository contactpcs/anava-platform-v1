import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientDashboard, AssessmentPermission } from "@/types/domain.types";

export const patientsService = {
  async getDashboard(): Promise<PatientDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    return data.data ?? data;
  },

  async getMyDoctor(): Promise<{ id: string; first_name: string; last_name: string; specialization?: string; phone?: string }> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.MY_DOCTOR);
    return data.data ?? data;
  },

  async getMyAssessments(): Promise<{ permissions: AssessmentPermission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.MY_ASSESSMENTS);
    const payload = data.data ?? data;

    const rawList: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.permissions)
        ? payload.permissions
        : Array.isArray(payload?.assessments)
          ? payload.assessments
          : [];

    if (rawList.length === 0) return { permissions: [], total: 0 };

    // New format: backend returns one item per disease with embedded scales[]
    const firstItem = rawList[0] as Record<string, unknown>;
    const isNewFormat = typeof firstItem.disease_id === "string" && Array.isArray(firstItem.scales);

    if (isNewFormat) {
      const permissions = rawList.map((item) => {
        const p = item as Record<string, unknown>;
        return {
          permission_id: String(p.permission_id ?? p.id ?? p.disease_id ?? ""),
          disease_id: String(p.disease_id ?? ""),
          disease_name: String(p.disease_name ?? p.disease_id ?? ""),
          granted_at: String(p.granted_at ?? ""),
          status: (p.status as AssessmentPermission["status"]) ?? "granted",
          scales: (p.scales as { scale_id: string; scale_name: string }[]) ?? [],
        } as AssessmentPermission;
      });
      return { permissions, total: permissions.length };
    }

    // Legacy format: one row per scale (id, disease_id, scale_id, prs_diseases, prs_scales, ...)
    const diseaseMap = new Map<string, AssessmentPermission>();

    for (const item of rawList) {
      const p = item as Record<string, unknown>;
      const diseaseId = String(p.disease_id ?? "");
      if (!diseaseId) continue;

      const scaleId = String(p.scale_id ?? "");
      const diseases = (p.prs_diseases as Record<string, unknown>) ?? {};
      const scaleInfo = (p.prs_scales as Record<string, unknown>) ?? {};

      if (!diseaseMap.has(diseaseId)) {
        diseaseMap.set(diseaseId, {
          permission_id: String(p.id ?? ""),
          disease_id: diseaseId,
          disease_name: (diseases.disease_name as string) || diseaseId,
          granted_at: String(p.granted_at ?? ""),
          status: (p.status as AssessmentPermission["status"]) ?? "granted",
          scales: scaleId
            ? [{ scale_id: scaleId, scale_name: (scaleInfo.scale_name as string) || scaleId }]
            : [],
        });
      } else {
        const existing = diseaseMap.get(diseaseId)!;
        if (scaleId && !existing.scales?.some((s) => s.scale_id === scaleId)) {
          existing.scales = existing.scales ?? [];
          existing.scales.push({
            scale_id: scaleId,
            scale_name: (scaleInfo.scale_name as string) || scaleId,
          });
        }
      }
    }

    const permissions = Array.from(diseaseMap.values());
    return { permissions, total: permissions.length };
  },
};
