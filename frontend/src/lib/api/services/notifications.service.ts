import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Notification } from "@/types/domain.types";

export const notificationsService = {
  async getNotifications(params?: { skip?: number; limit?: number }): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
    const { data } = await apiClient.get(ENDPOINTS.NOTIFICATIONS.LIST, { params });
    const payload = data.data ?? data;
    return {
      notifications: payload.notifications ?? payload ?? [],
      total: payload.total ?? 0,
      unread_count: payload.unread_count ?? 0,
    };
  },

  async markAllRead(): Promise<void> {
    await apiClient.put(ENDPOINTS.NOTIFICATIONS.READ_ALL);
  },

  async markRead(notificationId: string): Promise<void> {
    await apiClient.put(ENDPOINTS.NOTIFICATIONS.READ(notificationId));
  },
};
