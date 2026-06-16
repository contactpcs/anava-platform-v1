// ─── Doctor domain ───────────────────────────────────────────────

export interface PatientListItem {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  mrn?: string;
  date_of_birth?: string;
  gender?: string;
  condition?: string;
  status?: string;
  approval_status?: string;
  assigned_at?: string;
  registered_at?: string;
  created_at?: string;
  clinic_id?: string;
  clinic_name?: string;
  clinic_city?: string;
  last_prs?: {
    disease_id?: string;
    disease_name?: string;
    completed_at?: string;
  } | null;
}

export interface PatientDetail extends PatientListItem {
  permissions?: Permission[];
  scores?: ScoreSummaryItem[];
  sessions?: SessionSummary[];
  recent_sessions?: PatientSessionRecord[];
  medical_history?: string;
  emergency_contact?: string;
  blood_group?: string;
}

export interface PatientSessionRecord {
  id: string;
  session_date?: string;
  status?: string;
  session_type?: string;
  title?: string;
  doctor_id?: string;
  notes?: string;
}

export interface DoctorDashboard {
  doctor: {
    id: string;
    first_name: string;
    last_name: string;
    specialization?: string;
    availability_status?: string;
  };
  patient_count: number;
  pending_count?: number;
  recent_scores?: ScoreSummaryItem[];
}

// ─── Patient domain ───────────────────────────────────────────────

export interface PatientDashboard {
  profile: {
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    gender?: string;
  };
  assigned_doctor?: {
    id: string;
    full_name: string;
    first_name: string;
    last_name: string;
    specialization?: string;
    phone?: string;
  };
  pending_assessments?: AssessmentPermission[];
  recent_scores?: ScoreSummaryItem[];
}

export interface AssessmentPermission {
  permission_id: string;
  disease_id: string;
  disease_name: string;
  granted_at: string;
  status: "granted" | "completed" | "expired" | "revoked";
  scales?: { scale_id: string; scale_name: string }[];
}

// ─── Staff domain ─────────────────────────────────────────────────

export interface StaffDashboard {
  upcoming_sessions?: SessionSummary[];
  recent_scores?: ScoreSummaryItem[];
  patient_count?: number;
  pending_count?: number;
  registered_today?: number;
}

export interface DoctorListItem {
  id: string;
  first_name: string;
  last_name: string;
  specialization?: string;
  availability_status: "available" | "unavailable";
  patient_count: number;
  phone?: string;
}

export interface SessionSummary {
  id: string;
  patient_id: string;
  patient_name?: string;
  condition_id?: string;
  title?: string;
  status: string;
  assigned_at: string;
  due_date?: string;
}

// ─── Notifications ────────────────────────────────────────────────

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, unknown>;
}

// ─── PRS Permissions ─────────────────────────────────────────────

export interface Permission {
  permission_id: string;
  patient_id: string;
  granted_by: string;
  disease_id: string;
  disease_name?: string;
  scale_ids: string[];
  status: "granted" | "completed" | "expired" | "revoked";
  granted_at: string;
  completed_at?: string;
  expires_at?: string;
  instance_id?: string;
}

// ─── PRS Scores ───────────────────────────────────────────────────

export interface ScoreSummaryItem {
  instance_id?: string;
  scale_id?: string;
  scale_name?: string;
  scale_code?: string;
  disease_id?: string;
  disease_name?: string;
  total_score?: number;
  max_possible_score?: number;
  percentage?: number;
  severity_level?: string;
  severity_label?: string;
  completed_at?: string;
  recorded_at?: string;
}

export interface ScaleResultSummary {
  scale_id: string;
  scale_name?: string;
  scale_code?: string;
  calculated_value?: number;
  max_possible?: number;
  percentage?: number;
  severity_level?: string;
  severity_label?: string;
  subscale_scores?: Record<string, unknown>;
}

export interface AssessmentInstance {
  instance_id: string;
  disease_id: string;
  disease_name?: string;
  disease_score?: number;
  severity_level?: string;
  severity_label?: string;
  percentage?: number;
  completed_at?: string;
  scale_summaries?: ScaleResultSummary[];
}

export interface PatientScoreInstance {
  instance_id: string;
  disease_id?: string;
  disease_name?: string;
  completed_at: string;
  overall_severity?: string;
  scale_results: ScoreSummaryItem[];
}

// ─── Schedule ─────────────────────────────────────────────────────

export interface WeeklyScheduleRow {
  schedule_id?: string;
  doctor_id?: string;
  clinic_id?: string;
  day_of_week: number;   // DB: Sun=0, Mon=1, ..., Sat=6
  start_time: string;    // "HH:MM:SS"
  end_time: string;
  slot_duration_minutes: number;
  break_start?: string | null;
  break_end?: string | null;
  is_active: boolean;
  effective_from?: string | null;
  effective_until?: string | null;
}

export interface ScheduleOverride {
  override_id: string;
  doctor_id?: string;
  clinic_id?: string;
  override_date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  reason?: string | null;
}

export interface AvailabilitySlot {
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

// ─── Appointments ─────────────────────────────────────────────────

export type AppointmentStatus =
  | "scheduled" | "confirmed" | "checked_in" | "in_progress"
  | "completed" | "cancelled" | "no_show" | "rescheduled";

export type AppointmentType =
  | "consultation" | "follow_up" | "assessment" | "emergency" | "video";

export interface Appointment {
  appointment_id: string;
  clinic_id: string;
  patient_id: string;
  patient_name?: string;
  doctor_id: string;
  doctor_name?: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  start_at: string;
  end_at: string;
  status: AppointmentStatus;
  appointment_type: AppointmentType;
  reason?: string;
  notes?: string;
  patient_complaint?: string;
  booked_by: string;
  booked_by_role: string;
  created_at: string;
  updated_at: string;
}

// ─── Appointment Requests ────────────────────────────────────────

export type AppointmentRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type TimeWindow = "any" | "morning" | "afternoon" | "evening";
export type Urgency = "normal" | "urgent" | "emergency";

export interface AppointmentRequest {
  request_id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  patient_name?: string;
  doctor_name?: string;
  preferred_date_1: string;
  preferred_date_2?: string | null;
  preferred_date_3?: string | null;
  preferred_time_window: TimeWindow;
  patient_complaint: string;
  urgency: Urgency;
  reason?: string | null;
  status: AppointmentRequestStatus;
  review_notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Anamnesis ────────────────────────────────────────────────────

export interface AnamnesisResponse {
  question_id: string;
  response_value: string | null;
  response_values: string[] | null;
}

export interface AnamnesisRecord {
  anamnesis_id: string;
  patient_id: string;
  submitted_by: string | null;
  taken_by: string;
  status: "in_progress" | "completed";
  completed_at: string | null;
  responses?: AnamnesisResponse[];
  chief_complaint: string | null;
  main_symptoms: string | null;
  initial_symptoms: string | null;
  diagnosis_related: boolean | null;
  diagnosis_details: string | null;
  symptoms_start: string | null;
  symptoms_duration: string | null;
  symptoms_frequency: string | null;
  symptoms_intensity: string | null;
  symptoms_progression: string | null;
  secondary_symptoms: string[] | null;
  secondary_symptoms_details: string | null;
  has_operations: boolean | null;
  operations_details: string | null;
  previous_treatments: string | null;
  current_medications: string | null;
  has_brain_mri: boolean | null;
  mri_details: string | null;
  other_scans: string | null;
  has_neuromodulation: boolean | null;
  neuromodulation_details: string | null;
  created_at: string;
  updated_at: string;
}
