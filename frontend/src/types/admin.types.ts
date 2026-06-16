// ─── Admin Dashboard ──────────────────────────────────────────────
// Actual API shape: { data: { stats: {...}, clinic_breakdown: [...] } }

export interface AdminDashboardStats {
  total_clinics: number;
  total_doctors: number;
  total_receptionists: number;
  total_clinical_assistants: number;
  total_patients: number;
  pending_approvals: number;
  active_assessments: number;
}

export interface AdminDashboard {
  stats: AdminDashboardStats;
  clinic_breakdown: ClinicBreakdown[];
}

export interface ClinicBreakdown {
  clinic_id: string;
  clinic_name: string;
  city?: string;
  state?: string;
  is_active: boolean;
  staff_count: number;
  patient_count: number;
}

export interface RecentActivity {
  id: string;
  type: "patient_registered" | "staff_registered" | "clinic_created" | "patient_approved" | "patient_rejected" | string;
  description: string;
  timestamp: string;
  user_name?: string;
  clinic_name?: string;
}

// ─── Clinic ───────────────────────────────────────────────────────

export interface AdminClinic {
  clinic_id: string;
  clinic_name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  doctor_count?: number;
  staff_count?: number;
  patient_count?: number;
  created_at?: string;
}

export interface CreateClinicPayload {
  clinic_name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
}

// ─── Staff ────────────────────────────────────────────────────────

export interface AdminStaffMember {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: string;
  clinic_id?: string;
  clinic_name?: string;
  is_active: boolean;
  created_at?: string;
  registered_at?: string;
}

export interface RegisterStaffPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  role: string;
  clinic_id: string;
  phone?: string;
}

// ─── Patients ─────────────────────────────────────────────────────

export interface AdminPatient {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  clinic_id?: string;
  clinic_name?: string;
  approval_status: "pending" | "approved" | "rejected";
  mrn?: string;
  registered_at?: string;
  created_at?: string;
}

// ─── Notifications ────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string;
  link?: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}
