"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  selectNotifications,
  selectNotificationsStatus,
  selectUnreadCount,
  selectNotificationsTotal,
} from "@/store/slices/notificationsSlice";

export function useNotifications(params?: { skip?: number; limit?: number }) {
  const dispatch       = useAppDispatch();
  const notifications  = useAppSelector(selectNotifications);
  const total          = useAppSelector(selectNotificationsTotal);
  const unreadCount    = useAppSelector(selectUnreadCount);
  const status         = useAppSelector(selectNotificationsStatus);
  const { skip, limit } = params ?? {};

  useEffect(() => {
    dispatch(fetchNotifications(params));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, skip, limit]);

  const markRead    = useCallback((id: string) => dispatch(markNotificationRead(id)), [dispatch]);
  const markAllRead = useCallback(() => dispatch(markAllNotificationsRead()), [dispatch]);
  const refresh     = useCallback(
    (p?: { skip?: number; limit?: number }) => dispatch(fetchNotifications(p ?? params)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, skip, limit],
  );

  return {
    notifications,
    total,
    unreadCount,
    isLoading: status === "loading",
    isReady: status === "succeeded",
    markRead,
    markAllRead,
    refresh,
  };
}
