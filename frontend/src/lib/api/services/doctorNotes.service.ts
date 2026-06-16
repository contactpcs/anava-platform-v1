import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

function unwrap<T>(payload: unknown): T {
  const maybe = payload as Partial<ApiEnvelope<T>>;
  if (maybe && typeof maybe === "object" && "data" in maybe) return maybe.data as T;
  return payload as T;
}

export type DoctorNote = {
  id?: string;
  patient_id: string;
  doctor_id: string;
  note_text: string;
  created_at?: string;
  updated_at?: string;
};

export const doctorNotesService = {
  async getForPatient(patientId: string): Promise<DoctorNote | null> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTOR_NOTES.FOR_PATIENT(patientId));
    return unwrap<DoctorNote | null>(data);
  },

  async upsertForPatient(patientId: string, noteText: string): Promise<DoctorNote> {
    const { data } = await apiClient.put(ENDPOINTS.DOCTOR_NOTES.FOR_PATIENT(patientId), {
      note_text: noteText,
    });
    return unwrap<DoctorNote>(data);
  },

  async getMyNotes(): Promise<DoctorNote[]> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTOR_NOTES.ME);
    return unwrap<DoctorNote[]>(data) ?? [];
  },
};
