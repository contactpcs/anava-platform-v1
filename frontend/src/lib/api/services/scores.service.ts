import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AssessmentInstance, ScaleResultSummary } from "@/types/domain.types";

export type ScaleResultDetail = {
  scale_result_id: string;
  scale_id: string;
  scale_name?: string;
  scale_code?: string;
  calculated_value?: number;
  max_possible?: number;
  percentage?: number;
  severity_level?: string;
  severity_label?: string;
  subscale_scores?: Record<string, unknown>;
  risk_flags?: unknown[];
};

export type InstanceScoreDetail = {
  instance: {
    instance_id: string;
    disease_id?: string;
    disease_name?: string;
    status?: string;
    started_at?: string;
    completed_at?: string;
    initiated_by?: string;
  };
  disease_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    percentage?: number;
  };
  weighted_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    scale_breakdown?: Record<string, unknown>;
  };
  scale_results: ScaleResultDetail[];
};

export const scoresService = {
  async getMyScores(params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SCORES, { params });
    const payload = data.data ?? data;
    const items: AssessmentInstance[] = Array.isArray(payload) ? payload : payload?.data ?? [];
    return {
      instances: items,
      total: data.meta?.total ?? items.length,
    };
  },

  async getMyScoresSummary(): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SCORES_SUMMARY);
    const payload = data.data ?? data;
    return {
      instances: (payload.latest_by_disease ?? []) as AssessmentInstance[],
      total: payload.total_assessments ?? 0,
      diseases: payload.diseases_assessed ?? 0,
    };
  },

  async getInstanceScore(instanceId: string): Promise<InstanceScoreDetail> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId));
    return data.data ?? data;
  },

  async getPatientScores(patientId: string, params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES(patientId), { params });
    const payload = data.data ?? data;
    const items: AssessmentInstance[] = Array.isArray(payload) ? payload : payload?.data ?? [];
    return {
      instances: items,
      total: data.meta?.total ?? items.length,
    };
  },

  async getPatientScoresSummary(patientId: string): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES_SUMMARY(patientId));
    const payload = data.data ?? data;
    return {
      instances: (payload.latest_by_disease ?? []) as AssessmentInstance[],
      total: payload.total_assessments ?? 0,
      diseases: payload.diseases_assessed ?? 0,
    };
  },
};
