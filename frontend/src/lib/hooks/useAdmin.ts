"use client";

import { useState, useCallback } from "react";
import { adminService } from "@/lib/api/services/admin.service";
import type {
  AdminDashboard,
  AdminClinic,
  CreateClinicPayload,
  AdminStaffMember,
  RegisterStaffPayload,
  AdminPatient,
} from "@/types/admin.types";

// ─── Dashboard ────────────────────────────────────────────────────

export function useAdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getDashboard();
      setDashboard(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { dashboard, isLoading, error, fetch };
}

// ─── Clinics ──────────────────────────────────────────────────────

export function useAdminClinics() {
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getClinics();
      setClinics(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load clinics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createClinic = useCallback(async (payload: CreateClinicPayload) => {
    const created = await adminService.createClinic(payload);
    setClinics((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateClinic = useCallback(async (id: string, payload: Partial<CreateClinicPayload>) => {
    const updated = await adminService.updateClinic(id, payload);
    setClinics((prev) => prev.map((c) => (c.clinic_id === id ? updated : c)));
    return updated;
  }, []);

  const toggleClinic = useCallback(async (id: string, activate: boolean) => {
    if (activate) {
      await adminService.activateClinic(id);
    } else {
      await adminService.deactivateClinic(id);
    }
    setClinics((prev) =>
      prev.map((c) => (c.clinic_id === id ? { ...c, is_active: activate } : c))
    );
  }, []);

  return { clinics, isLoading, error, fetch, createClinic, updateClinic, toggleClinic };
}

// ─── Staff ────────────────────────────────────────────────────────

export function useAdminStaff() {
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { clinic_id?: string; role?: string; search?: string; skip?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { staff: list, total: count } = await adminService.getStaff(params);
      setStaff(list);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load staff");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerStaff = useCallback(async (payload: RegisterStaffPayload) => {
    const created = await adminService.registerStaff(payload);
    setStaff((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateStaff = useCallback(async (id: string, payload: Partial<RegisterStaffPayload>) => {
    const updated = await adminService.updateStaff(id, payload);
    setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const toggleStaff = useCallback(async (id: string, activate: boolean) => {
    if (activate) {
      await adminService.reactivateStaff(id);
    } else {
      await adminService.deactivateStaff(id);
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: activate } : s))
    );
  }, []);

  const deleteStaff = useCallback(async (id: string) => {
    await adminService.deleteStaff(id);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { staff, total, isLoading, error, fetch, registerStaff, updateStaff, toggleStaff, deleteStaff };
}

// ─── Patients ─────────────────────────────────────────────────────

export function useAdminPatients() {
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { clinic_id?: string; status?: string; search?: string; skip?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { patients: list, total: count } = await adminService.getPatients(params);
      setPatients(list);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approvePatient = useCallback(async (id: string) => {
    await adminService.approvePatient(id);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, approval_status: "approved" as const } : p))
    );
  }, []);

  const rejectPatient = useCallback(async (id: string) => {
    await adminService.rejectPatient(id);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, approval_status: "rejected" as const } : p))
    );
  }, []);

  const deletePatient = useCallback(async (id: string) => {
    await adminService.deletePatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { patients, total, isLoading, error, fetch, approvePatient, rejectPatient, deletePatient };
}
