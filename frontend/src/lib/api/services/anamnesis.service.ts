import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AnamnesisRecord } from "@/types/domain.types";

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

function unwrap<T>(payload: unknown): T {
  const maybe = payload as Partial<ApiEnvelope<T>>;
  if (maybe && typeof maybe === "object" && "data" in maybe) return maybe.data as T;
  return payload as T;
}

export type AnamnesisStartPayload = {
  patient_id: string;
  taken_by: "patient" | "doctor_on_behalf";
};

export type AnamnesisSaveResponsePayload = {
  anamnesis_id: string;
  question_id: string;
  response_value?: string | null;
  response_values?: string[] | null;
};

export type AnamnesisResponseItem = {
  question_id: string;
  response_value?: string | null;
  response_values?: string[] | null;
};

export type AnamnesisSavePayload = {
  anamnesis_id: string;
  chief_complaint?: string | null;
  main_symptoms?: string | null;
  initial_symptoms?: string | null;
  diagnosis_related?: boolean | null;
  diagnosis_details?: string | null;
  symptoms_start?: string | null;
  symptoms_duration?: string | null;
  symptoms_frequency?: string | null;
  symptoms_intensity?: string | null;
  symptoms_progression?: string | null;
  secondary_symptoms?: string[] | null;
  secondary_symptoms_details?: string | null;
  has_operations?: boolean | null;
  operations_details?: string | null;
  previous_treatments?: string | null;
  current_medications?: string | null;
  has_brain_mri?: boolean | null;
  mri_details?: string | null;
  other_scans?: string | null;
  has_neuromodulation?: boolean | null;
  neuromodulation_details?: string | null;
};

export type AnamnesisSubmitPayload = {
  anamnesis_id: string;
  responses?: AnamnesisResponseItem[] | null;
};

export type AnamnesisQuestion = {
  question_id: string;
  section_number: number;
  section_title: string;
  question_code: string;
  question_text: string;
  answer_type: string;
  is_required: boolean;
  display_order: number;
  depends_on_question_id?: string | null;
  depends_on_value?: string | null;
  helper_text?: string | null;
  options: Array<{
    option_id: string;
    option_label: string;
    option_value: string;
    display_order: number;
  }>;
};

export const anamnesisService = {
  async getQuestions(): Promise<AnamnesisQuestion[]> {
    const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.QUESTIONS);
    return unwrap<AnamnesisQuestion[]>(data);
  },

  async start(payload: AnamnesisStartPayload): Promise<{ anamnesis_id: string; status: "in_progress" | "completed"; resumed: boolean }> {
    const { data } = await apiClient.post(ENDPOINTS.ANAMNESIS.START, payload);
    return unwrap<{ anamnesis_id: string; status: "in_progress" | "completed"; resumed: boolean }>(data);
  },

  async saveResponse(payload: AnamnesisSaveResponsePayload): Promise<{ response_id: string }> {
    const { data } = await apiClient.post(ENDPOINTS.ANAMNESIS.SAVE_RESPONSE, payload);
    return unwrap<{ response_id: string }>(data);
  },

  async save(payload: AnamnesisSavePayload): Promise<AnamnesisRecord> {
    // Batch save all responses via individual saveResponse calls
    const responses: AnamnesisSaveResponsePayload[] = [];
    
    const fieldToQuestion: Record<string, string> = {
      chief_complaint: "q_chief_complaint",
      main_symptoms: "q_main_symptoms",
      initial_symptoms: "q_initial_symptoms",
      diagnosis_related: "q_diagnosis_related",
      diagnosis_details: "q_diagnosis_details",
      symptoms_start: "q_symptoms_start",
      symptoms_duration: "q_symptoms_duration",
      symptoms_frequency: "q_symptoms_frequency",
      symptoms_intensity: "q_symptoms_intensity",
      symptoms_progression: "q_symptoms_progression",
      secondary_symptoms: "q_secondary_symptoms",
      secondary_symptoms_details: "q_secondary_details",
      has_operations: "q_has_operations",
      operations_details: "q_operations_details",
      previous_treatments: "q_previous_treatments",
      current_medications: "q_current_medications",
      has_brain_mri: "q_has_brain_mri",
      mri_details: "q_mri_details",
      other_scans: "q_other_scans",
      has_neuromodulation: "q_has_neuromodulation",
      neuromodulation_details: "q_neuromodulation_details",
    };

    // Build individual response payloads
    for (const [field, questionId] of Object.entries(fieldToQuestion)) {
      const value = payload[field as keyof AnamnesisSavePayload];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          responses.push({
            anamnesis_id: payload.anamnesis_id,
            question_id: questionId,
            response_values: value,
          });
        } else if (typeof value === "boolean") {
          responses.push({
            anamnesis_id: payload.anamnesis_id,
            question_id: questionId,
            response_value: value ? "yes" : "no",
          });
        } else {
          responses.push({
            anamnesis_id: payload.anamnesis_id,
            question_id: questionId,
            response_value: String(value),
          });
        }
      }
    }

    // Save each response individually
    for (const resp of responses) {
      try {
        await this.saveResponse(resp);
      } catch (e) {
        // Log error but continue with other responses
        console.error(`Failed to save response for ${resp.question_id}:`, e);
      }
    }

    // Return a minimal record object (the actual record will be fetched when needed)
    return {
      anamnesis_id: payload.anamnesis_id,
      patient_id: "",
      status: "in_progress",
      taken_by: "patient",
      responses: [],
    } as any;
  },

  async submit(payload: AnamnesisSubmitPayload): Promise<AnamnesisRecord> {
    const { data } = await apiClient.post(ENDPOINTS.ANAMNESIS.SUBMIT, payload);
    return unwrap<AnamnesisRecord>(data);
  },

  async getMyAnamnesis(): Promise<AnamnesisRecord> {
    const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.ME);
    return unwrap<AnamnesisRecord>(data);
  },

  async getForPatient(patientId: string): Promise<AnamnesisRecord | null> {
    try {
      const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.FOR_PATIENT(patientId));
      return unwrap<AnamnesisRecord>(data);
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      throw err;
    }
  },
};

