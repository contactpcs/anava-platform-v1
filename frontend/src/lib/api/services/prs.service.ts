import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  Scale,
  ConditionBattery,
  AssessmentSession,
  ScaleResponse,
  RiskAlert,
  ScoreHistory,
} from "@/types/prs.types";

type BackendEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

function unwrapEnvelope<T>(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as BackendEnvelope<T>).data;
  }
  return payload;
}

function extractScaleIds(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];

  const maybeScaleIds = (item as { scale_ids?: unknown }).scale_ids;
  if (Array.isArray(maybeScaleIds) && maybeScaleIds.every((x) => typeof x === "string")) {
    return maybeScaleIds;
  }

  const maybeScales = (item as { scales?: unknown }).scales;
  if (!Array.isArray(maybeScales)) return [];

  return maybeScales
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const scaleId = (s as { scale_id?: unknown }).scale_id;
      const id = (s as { id?: unknown }).id;
      if (typeof scaleId === "string") return scaleId;
      if (typeof id === "string") return id;
      return null;
    })
    .filter((x): x is string => Boolean(x));
}

function normalizeDiseaseToConditionBattery(item: unknown, index: number): ConditionBattery | null {
  if (!item || typeof item !== "object") return null;

  const obj = item as Record<string, unknown>;

  const diseaseId =
    (typeof obj.disease_id === "string" && obj.disease_id) ||
    (typeof obj.condition_id === "string" && obj.condition_id) ||
    (typeof obj.id === "string" && obj.id) ||
    null;

  if (!diseaseId) return null;

  const label =
    (typeof obj.disease_name === "string" && obj.disease_name) ||
    (typeof obj.label === "string" && obj.label) ||
    (typeof obj.disease_code === "string" && obj.disease_code) ||
    diseaseId;

  const description =
    (typeof obj.description === "string" && obj.description) ||
    (typeof obj.disease_description === "string" && obj.disease_description) ||
    null;

  const isActiveRaw = obj.status ?? obj.is_active;
  const is_active = typeof isActiveRaw === "boolean" ? isActiveRaw : true;

  const displayOrderRaw = obj.display_order;
  const display_order = typeof displayOrderRaw === "number" ? displayOrderRaw : index;

  const scale_ids = extractScaleIds(obj);
  const scalesRaw = (obj as { scales?: unknown }).scales;
  const scales = Array.isArray(scalesRaw) ? (scalesRaw as Scale[]) : undefined;

  return {
    id: diseaseId,
    condition_id: diseaseId,
    label,
    description,
    scale_ids,
    scales,
    is_active,
    display_order,
  };
}

function normalizeConditionsList(payload: unknown): { conditions: ConditionBattery[]; total: number } {
  // Legacy shape: { conditions: [...], total: number }
  if (payload && typeof payload === "object" && "conditions" in payload) {
    const conds = (payload as { conditions?: unknown }).conditions;
    const total = (payload as { total?: unknown }).total;
    if (Array.isArray(conds)) {
      return {
        conditions: conds as ConditionBattery[],
        total: typeof total === "number" ? total : conds.length,
      };
    }
  }

  // New shape: envelope or direct array under `data`
  const unwrapped = unwrapEnvelope<unknown[]>(payload);
  if (Array.isArray(unwrapped)) {
    const conditions = unwrapped
      .map((item, idx) => normalizeDiseaseToConditionBattery(item, idx))
      .filter((x): x is ConditionBattery => Boolean(x));
    return { conditions, total: conditions.length };
  }

  return { conditions: [], total: 0 };
}

function normalizeConditionDetail(payload: unknown): ConditionBattery {
  const unwrapped = unwrapEnvelope<unknown>(payload);

  // If it already looks like a ConditionBattery, return as-is.
  if (unwrapped && typeof unwrapped === "object" && "condition_id" in unwrapped && "label" in unwrapped) {
    return unwrapped as ConditionBattery;
  }

  const mapped = normalizeDiseaseToConditionBattery(unwrapped, 0);
  return (
    mapped ??
    ({
      id: "unknown",
      condition_id: "unknown",
      label: "Unknown Condition",
      description: null,
      scale_ids: [],
      is_active: true,
      display_order: 0,
    } as ConditionBattery)
  );
}

export const prsService = {
  // ─── Scales ───
  async getScales(): Promise<{ scales: Scale[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCALES);
    return data;
  },

  async getScale(scaleId: string): Promise<Scale> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCALE(scaleId));
    return data;
  },

  // ─── Conditions ───
  async getConditions(): Promise<{ conditions: ConditionBattery[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITIONS);
    return normalizeConditionsList(data);
  },

  async getCondition(conditionId: string): Promise<ConditionBattery> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITION(conditionId));
    return normalizeConditionDetail(data);
  },

  // ─── Sessions ───
  async createSession(payload: {
    patient_id: string;
    condition_id?: string;
    custom_scale_ids?: string[];
    title?: string;
    clinical_notes?: string;
    patient_instructions?: string;
    mode?: string;
    due_date?: string;
  }): Promise<AssessmentSession> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.SESSIONS, payload);
    return data;
  },

  async getMySessions(params?: { skip?: number; limit?: number }): Promise<{ sessions: AssessmentSession[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SESSIONS, { params });
    return data;
  },

  async getPatientSessions(patientId: string, params?: { skip?: number; limit?: number }): Promise<{ sessions: AssessmentSession[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SESSIONS(patientId), { params });
    return data;
  },

  async getSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SESSION(sessionId));
    return data;
  },

  async startSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.START_SESSION(sessionId));
    return data;
  },

  async cancelSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.CANCEL_SESSION(sessionId));
    return data;
  },

  // ─── Responses ───
  async autoSave(sessionId: string, scaleId: string, questionIndex: number, value: number | string): Promise<void> {
    await apiClient.patch(ENDPOINTS.PRS.AUTO_SAVE(sessionId, scaleId), {
      question_index: questionIndex,
      value,
    });
  },

  async submitResponse(sessionId: string, scaleId: string, responses: Record<string, number | string>): Promise<{
    response: ScaleResponse;
    score: Record<string, unknown>;
    risk_alerts_created: number;
    session_completed: boolean;
  }> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.SUBMIT_RESPONSE(sessionId, scaleId), { responses });
    return data;
  },

  async submitClinicianRating(sessionId: string, scaleId: string, responses: Record<string, number | string>, clinicianNotes?: string): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.CLINICIAN_RATING(sessionId, scaleId), {
      responses,
      clinician_notes: clinicianNotes,
    });
    return data;
  },

  // ─── Consent ───
  async recordConsent(sessionId: string, consentType: string, consented: boolean, consentText?: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PRS.CONSENT(sessionId), {
      consent_type: consentType,
      consented,
      consent_text: consentText,
    });
  },

  // ─── Alerts ───
  async getMyAlerts(status?: string): Promise<{ alerts: RiskAlert[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_ALERTS, { params: { status } });
    return data;
  },

  async getPatientAlerts(patientId: string, status?: string): Promise<{ alerts: RiskAlert[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_ALERTS(patientId), { params: { status } });
    return data;
  },

  async acknowledgeAlert(alertId: string): Promise<RiskAlert> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.ACKNOWLEDGE_ALERT(alertId));
    return data;
  },

  async resolveAlert(alertId: string, resolutionNotes: string): Promise<RiskAlert> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.RESOLVE_ALERT(alertId), {
      resolution_notes: resolutionNotes,
    });
    return data;
  },

  // ─── Score History ───
  async getScoreHistory(patientId: string, scaleId?: string): Promise<{ history: ScoreHistory[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCORE_HISTORY(patientId), { params: { scale_id: scaleId } });
    return data;
  },
};
