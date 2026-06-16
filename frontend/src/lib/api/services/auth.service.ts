import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { LoginCredentials, AuthResponse, RegisterData, RegisterResponse, ConsentFormItem } from "@/types/auth.types";

export interface Clinic {
  clinic_id: string;
  clinic_name: string;
  city?: string;
  state?: string;
  address?: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);
    return response.data.data || response.data;
  },

  async register(formData: RegisterData): Promise<RegisterResponse> {
    const payload = {
      full_name: `${formData.first_name} ${formData.last_name}`.trim(),
      email: formData.email,
      password: formData.password,
      role: "patient",
      clinic_id: formData.clinic_id,
      phone: formData.phone,
      date_of_birth: formData.date_of_birth,
      gender: formData.gender,
      city: formData.city,
      state: formData.state,
      country: formData.country || "India",
      consent_responses: formData.consent_responses || [],
    };
    const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER, payload);
    return response.data.data || response.data;
  },

  async getConsentForms(): Promise<ConsentFormItem[]> {
    const response = await apiClient.get(ENDPOINTS.CONSENT.FORMS);
    return response.data.data || [];
  },

  async getClinics(): Promise<Clinic[]> {
    const response = await apiClient.get(ENDPOINTS.AUTH.CLINICS);
    const payload = response.data.data ?? response.data;
    return Array.isArray(payload) ? payload : [];
  },

  async syncProfile(data: Partial<RegisterData> & { email: string; full_name?: string }): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.SYNC_PROFILE, data);
  },
};
