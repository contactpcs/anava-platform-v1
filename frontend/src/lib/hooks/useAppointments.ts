"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAppointments,
  fetchTodayAppointments,
  fetchUpcomingAppointments,
  fetchAppointmentById,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  markNoShow,
  setFilters,
  selectAppointments,
  selectTodayAppointments,
  selectUpcomingAppointments,
  selectAppointmentById,
  selectAppointmentsStatus,
  selectTodayStatus,
} from "@/store/slices/appointmentsSlice";
import type { AppointmentStatus } from "@/types/domain.types";

export function useAppointments(params?: {
  date_from?: string;
  date_to?: string;
  status?: AppointmentStatus;
  skip?: boolean;
}) {
  const dispatch    = useAppDispatch();
  const list        = useAppSelector(selectAppointments);
  const listStatus  = useAppSelector(selectAppointmentsStatus);
  const { date_from, date_to, status, skip } = params ?? {};

  useEffect(() => {
    if (skip) return;
    dispatch(fetchAppointments({ date_from, date_to, status }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, date_from, date_to, status, skip]);

  const refresh = useCallback(
    () => dispatch(fetchAppointments({ date_from, date_to, status })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, date_from, date_to, status],
  );

  return { appointments: list, isLoading: listStatus === "loading", refresh };
}

export function useTodayAppointments() {
  const dispatch = useAppDispatch();
  const today    = useAppSelector(selectTodayAppointments);
  const status   = useAppSelector(selectTodayStatus);

  useEffect(() => { dispatch(fetchTodayAppointments()); }, [dispatch]);

  const refresh = useCallback(() => dispatch(fetchTodayAppointments()), [dispatch]);
  return { today, isLoading: status === "loading", refresh };
}

export function useUpcomingAppointments() {
  const dispatch  = useAppDispatch();
  const upcoming  = useAppSelector(selectUpcomingAppointments);

  useEffect(() => { dispatch(fetchUpcomingAppointments()); }, [dispatch]);

  return { upcoming };
}

export function useAppointmentDetail(id: string) {
  const dispatch   = useAppDispatch();
  const appointment = useAppSelector(selectAppointmentById(id));

  useEffect(() => {
    if (id) dispatch(fetchAppointmentById(id));
  }, [dispatch, id]);

  const confirm    = useCallback(() => dispatch(confirmAppointment(id)).unwrap(),    [dispatch, id]);
  const checkIn    = useCallback(() => dispatch(checkInAppointment(id)).unwrap(),    [dispatch, id]);
  const start      = useCallback(() => dispatch(startAppointment(id)).unwrap(),      [dispatch, id]);
  const complete   = useCallback(() => dispatch(completeAppointment(id)).unwrap(),   [dispatch, id]);
  const noShow     = useCallback(() => dispatch(markNoShow(id)).unwrap(),            [dispatch, id]);
  const cancel     = useCallback(
    (reason: string) => dispatch(cancelAppointment({ id, cancellation_reason: reason })).unwrap(),
    [dispatch, id],
  );
  const reschedule = useCallback(
    (date: string, time: string, reason?: string) =>
      dispatch(rescheduleAppointment({ id, appointment_date: date, start_time: time, reason })).unwrap(),
    [dispatch, id],
  );

  return { appointment, confirm, checkIn, start, complete, noShow, cancel, reschedule };
}

export { setFilters };
