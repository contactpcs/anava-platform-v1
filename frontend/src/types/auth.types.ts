export type UserRole = "patient" | "doctor" | "clinical_assistant" | "receptionist" | "platform_admin" | "clinical_admin";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: UserRole[];
  permissions: string[];
  clinic_id?: string;
  clinic_name?: string;
  clinic_city?: string;
  
  // Contact & Location
  phone?: string;
  address_line1?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  primary_language?: string;
  
  // Medical
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  known_allergies?: string;
  medical_history?: string;
  current_medications?: string;
  
  // Emergency Contact
  emergency_contact?: string;
  
  // Insurance
  insurance_provider?: string;
  policy_number?: string;
  
  // Personal
  occupation?: string;
  marital_status?: string;
  referred_by?: string;
  
  // Identity
  full_name?: string;
  government_id?: string;
  id_type?: string;
  language_pref?: string;

  // Doctor-specific
  specialisation?: string;
  hospital?: string;
  years_of_experience?: number;

  // System Fields
  mrn?: string;
  approval_status?: string;
  registered_at?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ConsentFormItem {
  consent_form_id: string;
  consent_form_name: string;
  is_required: boolean;
  created_at?: string;
}

export interface ConsentResponseItem {
  consent_form_id: string;
  response: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone: string;
  clinic_id: string;
  date_of_birth: string;
  gender: string;
  city: string;
  state: string;
  country?: string;
  consent_responses?: ConsentResponseItem[];
}

export interface RegisterResponse {
  message: string;
  clinic_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface JWTPayload {
  sub: string;
  email: string;
  first_name: string;
  roles: string[];
  permissions: string[];
  exp: number;
}
