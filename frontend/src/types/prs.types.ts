export interface Scale {
  id: string;
  scale_id: string;
  short_name: string;
  full_name: string;
  category: string;
  version: string;
  scoring_type: string;
  max_score: number | null;
  estimated_minutes: number;
  is_active: boolean;
  is_clinician_rated: boolean;
  languages: string[];
  definition?: ScaleDefinition;
}

export interface ScaleDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  recallPeriod?: string;
  instructions?: string;
  scoringType: string;
  maxScore: number;
  maxItemScore?: number;
  questions: ScaleQuestion[];
  severityBands?: SeverityBand[];
  subscales?: Subscale[];
  domains?: Record<string, Domain>;
  components?: Component[];
  riskRules?: RiskRule[];
  subscaleSeverityBands?: Record<string, SeverityBand[]>;
  reverseItems?: number[];
  interpretation?: Record<string, unknown>;
}

export interface ScaleQuestion {
  index: number;
  id?: number;
  label: string;
  type: "likert" | "vas" | "nrs" | "numeric" | "time" | "text" | "functional";
  required: boolean;
  scoredInTotal?: boolean;
  includeInScore?: boolean;
  subscale?: string;
  dimension?: string;
  options?: QuestionOption[];
  min?: number;
  max?: number;
  step?: number;
  conditional?: ConditionalRule;
  isVAS?: boolean;
}

export interface QuestionOption {
  value: number;
  label: string;
  points?: number;
}

export interface SeverityBand {
  min: number;
  max: number;
  level: string;
  label: string;
  description?: string;
  color?: string;
  recommendation?: string;
}

export interface Subscale {
  id: string;
  name: string;
  items: number[];
  questionIndices?: number[];
  maxScore: number;
  multiplier?: number;
  description?: string;
  severityBands?: SeverityBand[];
}

export interface Domain {
  name: string;
  items: number[];
  questionIndices?: number[];
  divisor?: number;
  multiplier?: number;
  weight?: number;
  maxWeighted?: number;
  maxScore?: number;
}

export interface Component {
  id: string;
  name: string;
  questionIndices?: number[];
  items?: number[];
  maxScore: number;
  scoringRules?: {
    type: string;
    ranges?: Array<{ min: number; max: number; score: number }>;
    bedtimeQuestion?: number;
    waketimeQuestion?: number;
    sleepDurationQuestion?: number;
  };
}

export interface RiskRule {
  questionIndex?: number;
  subscale?: string;
  operator?: string;
  threshold?: number;
  condition?: string;
  type: string;
  severity: string;
  message: string;
  recommendation?: string;
}

export interface ConditionalRule {
  questionIndex: number;
  operator: string;
  value: number;
}

export interface ConditionBattery {
  id: string;
  condition_id: string;
  label: string;
  description: string | null;
  scale_ids: string[];
  scales?: Scale[];
  is_active: boolean;
  display_order: number;
}

export interface AssessmentSession {
  id: string;
  patient_id: string;
  assigned_by: string;
  condition_id: string | null;
  resolved_scale_ids: string[];
  title: string | null;
  clinical_notes: string | null;
  patient_instructions: string | null;
  mode: "self" | "clinician_administered" | "voice";
  status: SessionStatus;
  assigned_at: string;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  overall_severity: string | null;
  risk_flag_count: number;
  scales_completed: number;
  scales_total: number;
  report_blob_path: string | null;
  scale_responses?: ScaleResponse[];
  risk_alerts?: RiskAlert[];
}

export type SessionStatus = "assigned" | "in_progress" | "completed" | "expired" | "cancelled" | "clinician_review";

export interface ScaleResponse {
  id: string;
  session_id: string;
  scale_id: string;
  responses: Record<string, number | string> | null;
  total_score: number | null;
  max_possible_score: number | null;
  percentage: number | null;
  severity_level: string | null;
  severity_label: string | null;
  subscale_scores: Record<string, unknown> | null;
  domain_scores: Record<string, unknown> | null;
  component_scores: Record<string, unknown> | null;
  is_positive: boolean | null;
  vas_score: number | null;
  status: ResponseStatus;
  started_at: string | null;
  completed_at: string | null;
  time_taken_seconds: number | null;
  display_order: number;
  clinician_notes: string | null;
}

export type ResponseStatus = "pending" | "in_progress" | "completed" | "clinician_pending" | "clinician_completed";

export interface RiskAlert {
  id: string;
  session_id: string;
  patient_id: string;
  alert_type: string;
  severity: "critical" | "high" | "moderate" | "low";
  message: string;
  source_scale_id: string | null;
  source_question_index: number | null;
  source_value: number | null;
  status: "active" | "acknowledged" | "resolved" | "escalated";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface ScoreHistory {
  id: string;
  patient_id: string;
  scale_id: string;
  session_id: string;
  total_score: number;
  max_possible_score: number | null;
  percentage: number | null;
  severity_level: string | null;
  severity_label: string | null;
  recorded_at: string;
}
