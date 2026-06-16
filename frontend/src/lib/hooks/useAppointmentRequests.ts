"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAppointmentRequests,
  createAppointmentRequest,
  approveAppointmentRequest,
  rejectAppointmentRequest,
  cancelAppointmentRequest,
  selectRequests,
  selectPendingRequests,
  selectRequestsStatus,
  selectPendingCount,
} from "@/store/slices/appointmentRequestsSlice";
import type { CreateRequestPayload, ApproveRequestPayload } from "@/lib/api/services/appointmentRequests.service";

export function useAppointmentRequests(params?: { status?: string; skip?: boolean }) {
  const dispatch  = useAppDispatch();
  const items     = useAppSelector(selectRequests);
  const status    = useAppSelector(selectRequestsStatus);
  const { status: statusFilter, skip } = params ?? {};

  useEffect(() => {
    if (skip) return;
    dispatch(fetchAppointmentRequests(statusFilter ? { status: statusFilter } : undefined));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, statusFilter, skip]);

  const refresh = useCallback(
    () => dispatch(fetchAppointmentRequests(statusFilter ? { status: statusFilter } : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dispatch, statusFilter],
  );

  return { requests: items, isLoading: status === "loading", refresh };
}

export function usePendingRequests() {
  const dispatch      = useAppDispatch();
  const pending       = useAppSelector(selectPendingRequests);
  const pendingCount  = useAppSelector(selectPendingCount);
  const loadStatus    = useAppSelector(selectRequestsStatus);

  useEffect(() => {
    dispatch(fetchAppointmentRequests({ status: "pending" }));
  }, [dispatch]);

  const refresh = useCallback(() => dispatch(fetchAppointmentRequests({ status: "pending" })), [dispatch]);

  const approve = useCallback(
    (id: string, payload: ApproveRequestPayload) =>
      dispatch(approveAppointmentRequest({ id, payload })).unwrap(),
    [dispatch],
  );

  const reject = useCallback(
    (id: string, notes: string) =>
      dispatch(rejectAppointmentRequest({ id, notes })).unwrap(),
    [dispatch],
  );

  return { pending, pendingCount, isLoading: loadStatus === "loading", refresh, approve, reject };
}

export function useSubmitAppointmentRequest() {
  const dispatch = useAppDispatch();

  const submit = useCallback(
    (payload: CreateRequestPayload) =>
      dispatch(createAppointmentRequest(payload)).unwrap(),
    [dispatch],
  );

  const cancel = useCallback(
    (id: string) => dispatch(cancelAppointmentRequest(id)).unwrap(),
    [dispatch],
  );

  return { submit, cancel };
}
