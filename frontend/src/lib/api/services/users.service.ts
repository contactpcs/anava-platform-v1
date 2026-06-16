import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { User } from "@/types/auth.types";

export const usersService = {
  async getProfile(): Promise<User> {
    const { data } = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    return data.data ?? data;
  },

  async updateProfile(payload: Record<string, unknown>): Promise<User> {
    await apiClient.put(ENDPOINTS.USERS.PROFILE, payload);
    return usersService.getProfile();
  },
};
