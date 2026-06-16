import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AppointmentRequest, AppointmentType, TimeWindow, Urgency } from "@/types/domain.types";

function extract<T>(res: { data: unknown }): T {
  const d = res.data as Record<string, unknown>;
  return (d?.data ?? d) as T;
}

export interface AppointmentRequestListParams {
  status?: string;
  skip?: number;
  limit?: number;
}

export interface CreateRequestPayload {
  preferred_date_1: string;
  preferred_date_2?: string;
  preferred_date_3?: string;
  preferred_time_window: TimeWindow;
  patient_complaint: string;
  urgency: Urgency;
  reason?: string;
}

export interface ApproveRequestPayload {
  appointment_date: string;
  start_time: string;
  appointment_type: AppointmentType;
  notes?: string;
}

export const appointmentRequestsService = {
  list: async (params?: AppointmentRequestListParams) => {
    const res = await apiClient.get(ENDPOINTS.APPOINTMENT_REQUESTS.LIST, { params });
    const d = res.data as Record<string, unknown>;
    const items = (d?.data ?? d) as AppointmentRequest[];
    return {
      requests: Array.isArray(items) ? items : [],
      total: (d?.total as number) ?? 0,
    };
  },

  create: async (payload: CreateRequestPayload): Promise<AppointmentRequest> => {
    const res = await apiClient.post(ENDPOINTS.APPOINTMENT_REQUESTS.CREATE, payload);
    return extract<AppointmentRequest>(res);
  },

  approve: async (id: string, payload: ApproveRequestPayload): Promise<AppointmentRequest> => {
    const res = await apiClient.post(ENDPOINTS.APPOINTMENT_REQUESTS.APPROVE(id), payload);
    return extract<AppointmentRequest>(res);
  },

  reject: async (id: string, review_notes: string): Promise<AppointmentRequest> => {
    const res = await apiClient.post(ENDPOINTS.APPOINTMENT_REQUESTS.REJECT(id), { review_notes });
    return extract<AppointmentRequest>(res);
  },

  cancel: async (id: string): Promise<AppointmentRequest> => {
    const res = await apiClient.post(ENDPOINTS.APPOINTMENT_REQUESTS.CANCEL(id), {});
    return extract<AppointmentRequest>(res);
  },
};
