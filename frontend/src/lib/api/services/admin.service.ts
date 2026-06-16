import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  AdminDashboard,
  AdminClinic,
  CreateClinicPayload,
  AdminStaffMember,
  RegisterStaffPayload,
  AdminPatient,
} from "@/types/admin.types";

export const adminService = {
  // ─── Dashboard ────────────────────────────────────────────────────
  async getDashboard(): Promise<AdminDashboard> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.DASHBOARD);
    return res.data.data ?? res.data;
  },

  // ─── Clinics ──────────────────────────────────────────────────────
  async getClinics(): Promise<AdminClinic[]> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.CLINICS);
    const payload = res.data.data ?? res.data;
    return Array.isArray(payload) ? payload : [];
  },

  async getClinic(id: string): Promise<AdminClinic> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.CLINIC(id));
    return res.data.data ?? res.data;
  },

  async createClinic(payload: CreateClinicPayload): Promise<AdminClinic> {
    // POST /admin/clinics — standard admin clinic creation
    const res = await apiClient.post(ENDPOINTS.ADMIN.CLINICS, payload);
    return res.data.data ?? res.data;
  },

  async updateClinic(id: string, payload: Partial<CreateClinicPayload>): Promise<AdminClinic> {
    const res = await apiClient.put(ENDPOINTS.ADMIN.CLINIC(id), payload);
    return res.data.data ?? res.data;
  },

  async activateClinic(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.ACTIVATE_CLINIC(id));
  },

  async deactivateClinic(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.DEACTIVATE_CLINIC(id));
  },

  // ─── Staff ────────────────────────────────────────────────────────
  async getStaff(params?: { clinic_id?: string; role?: string; search?: string; skip?: number; limit?: number }): Promise<{ staff: AdminStaffMember[]; total: number }> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.STAFF, { params });
    const payload = res.data.data ?? res.data;
    const list: AdminStaffMember[] = Array.isArray(payload) ? payload : (payload?.staff ?? payload?.items ?? []);
    return { staff: list, total: res.data.meta?.total ?? payload?.total ?? list.length };
  },

  async getStaffMember(id: string): Promise<AdminStaffMember> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.STAFF_MEMBER(id));
    return res.data.data ?? res.data;
  },

  async registerStaff(payload: RegisterStaffPayload): Promise<AdminStaffMember> {
    const res = await apiClient.post(ENDPOINTS.ADMIN.REGISTER_STAFF, payload);
    return res.data.data ?? res.data;
  },

  async updateStaff(id: string, payload: Partial<RegisterStaffPayload>): Promise<AdminStaffMember> {
    const res = await apiClient.put(ENDPOINTS.ADMIN.STAFF_MEMBER(id), payload);
    return res.data.data ?? res.data;
  },

  async deactivateStaff(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.DEACTIVATE_STAFF(id));
  },

  async reactivateStaff(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.REACTIVATE_STAFF(id));
  },

  async deleteStaff(id: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.ADMIN.DELETE_STAFF(id));
  },

  // ─── Patients ────────────────────────────────────────────────────
  async getPatients(params?: { clinic_id?: string; status?: string; search?: string; skip?: number; limit?: number }): Promise<{ patients: AdminPatient[]; total: number }> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.PATIENTS, { params });
    const payload = res.data.data ?? res.data;
    const list: AdminPatient[] = Array.isArray(payload) ? payload : (payload?.patients ?? payload?.items ?? []);
    return { patients: list, total: res.data.meta?.total ?? payload?.total ?? list.length };
  },

  async approvePatient(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.APPROVE_PATIENT(id));
  },

  async rejectPatient(id: string): Promise<void> {
    await apiClient.put(ENDPOINTS.ADMIN.REJECT_PATIENT(id));
  },

  async deletePatient(id: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.ADMIN.DELETE_PATIENT(id));
  },
};
