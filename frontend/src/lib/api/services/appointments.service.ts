import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { Appointment, AppointmentStatus, AppointmentType } from "@/types/domain.types";

export interface AppointmentListParams {
  date_from?: string;
  date_to?: string;
  status?: AppointmentStatus;
  doctor_id?: string;
  patient_id?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  appointment_type?: AppointmentType;
  reason?: string;
  notes?: string;
  patient_complaint?: string;
}

export interface AppointmentReschedulePayload {
  appointment_date: string;
  start_time: string;
  reason?: string;
}

export interface AppointmentCancelPayload {
  cancellation_reason: string;
}

function extractList(data: any): Appointment[] {
  return data?.data ?? data?.appointments ?? [];
}

function extractItem(data: any): Appointment {
  return data?.data ?? data;
}

export const appointmentsService = {
  async list(params?: AppointmentListParams): Promise<{ appointments: Appointment[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params });
    return { appointments: extractList(data), total: data?.total ?? 0 };
  },

  async getUpcoming(): Promise<Appointment[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.UPCOMING);
    return extractList(data);
  },

  async getToday(): Promise<Appointment[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.TODAY);
    return extractList(data);
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.GET(id));
    return extractItem(data);
  },

  async create(payload: AppointmentCreatePayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.LIST, payload);
    return extractItem(data);
  },

  async update(id: string, payload: { notes?: string; patient_complaint?: string; appointment_type?: AppointmentType }): Promise<Appointment> {
    const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.UPDATE(id), payload);
    return extractItem(data);
  },

  async confirm(id: string): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.CONFIRM(id));
    return extractItem(data);
  },

  async checkIn(id: string): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.CHECK_IN(id));
    return extractItem(data);
  },

  async start(id: string): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.START(id));
    return extractItem(data);
  },

  async complete(id: string): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.COMPLETE(id));
    return extractItem(data);
  },

  async cancel(id: string, payload: AppointmentCancelPayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.CANCEL(id), payload);
    return extractItem(data);
  },

  async reschedule(id: string, payload: AppointmentReschedulePayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.RESCHEDULE(id), payload);
    return extractItem(data);
  },

  async markNoShow(id: string): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.NO_SHOW(id));
    return extractItem(data);
  },

  async getHistory(id: string): Promise<any[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.HISTORY(id));
    return data?.data ?? data ?? [];
  },
};
