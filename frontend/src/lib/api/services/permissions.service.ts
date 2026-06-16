import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Permission } from "@/types/domain.types";

export const permissionsService = {
  async grantPermission(payload: { patient_id: string; disease_id: string; scale_ids?: string[] }): Promise<Permission> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.PERMISSIONS, payload);
    return data.data ?? data;
  },

  async getMyPermissions(): Promise<{ permissions: Permission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_PERMISSIONS);
    const payload = data.data ?? data;
    return {
      permissions: payload.permissions ?? (Array.isArray(payload) ? payload : []),
      total: payload.total ?? 0,
    };
  },

  async getPatientPermissions(patientId: string): Promise<{ permissions: Permission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_PERMISSIONS(patientId));
    const payload = data.data ?? data;

    // Backend now returns deduplicated disease-level entries — map directly
    const rawList: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.permissions)
        ? payload.permissions
        : [];

    const permissions: Permission[] = rawList.map((item) => {
      const p = item as Record<string, unknown>;
      return {
        permission_id: String(p.permission_id ?? p.id ?? ""),
        patient_id:    String(p.patient_id ?? ""),
        granted_by:    String(p.granted_by ?? p.doctor_id ?? ""),
        disease_id:    String(p.disease_id ?? ""),
        disease_name:  p.disease_name as string | undefined,
        scale_ids:     (p.scale_ids as string[]) ?? [],
        status:        (p.status as Permission["status"]) ?? "granted",
        granted_at:    String(p.granted_at ?? ""),
        expires_at:    p.expires_at ? String(p.expires_at) : undefined,
        instance_id:   p.instance_id ? String(p.instance_id) : undefined,
      };
    });

    return { permissions, total: permissions.length };
  },

  async revokePermission(permissionId: string): Promise<Permission> {
    const { data } = await apiClient.put(ENDPOINTS.PRS.REVOKE_PERMISSION(permissionId));
    return data.data ?? data;
  },
};
