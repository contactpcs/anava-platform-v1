"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCAPatients,
  fetchCAPatient,
  fetchCAPatientResult,
  selectCAPatients,
  selectCAPatientsTotal,
  selectCAPatientsStatus,
  selectCAPatientDetail,
  selectCAResults,
} from "@/store/slices/clinicalAssistantSlice";
import {
  fetchPatientPermissions,
  selectPatientPermissions,
} from "@/store/slices/permissionsSlice";
import {
  fetchMyAlerts,
  selectMyAlerts,
  selectAlertsStatus,
} from "@/store/slices/alertsSlice";

export function useCAPatients(params?: { page?: number; limit?: number; search?: string }) {
  const dispatch = useAppDispatch();
  const patients = useAppSelector(selectCAPatients);
  const total    = useAppSelector(selectCAPatientsTotal);
  const status   = useAppSelector(selectCAPatientsStatus);
  const { page, limit, search } = params ?? {};

  useEffect(() => {
    dispatch(fetchCAPatients(params));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, page, limit, search]);

  return { patients, total, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useCAPatient(id: string) {
  const dispatch = useAppDispatch();
  const detail   = useAppSelector(selectCAPatientDetail);

  useEffect(() => {
    dispatch(fetchCAPatient(id));
  }, [dispatch, id]);

  return detail[id] || detail.current || null;
}

export function useCAPatientResult(patientId: string, instanceId: string) {
  const dispatch = useAppDispatch();
  const results  = useAppSelector(selectCAResults);

  useEffect(() => {
    dispatch(fetchCAPatientResult({ patientId, instanceId }));
  }, [dispatch, patientId, instanceId]);

  return results[instanceId] || null;
}

export function useCAPatientPermissions(patientId: string) {
  const dispatch    = useAppDispatch();
  const permissions = useAppSelector(selectPatientPermissions(patientId));

  useEffect(() => {
    dispatch(fetchPatientPermissions(patientId));
  }, [dispatch, patientId]);

  return permissions;
}

export function useMyAlerts() {
  const dispatch = useAppDispatch();
  const alerts   = useAppSelector(selectMyAlerts);
  const status   = useAppSelector(selectAlertsStatus);

  useEffect(() => {
    dispatch(fetchMyAlerts());
  }, [dispatch]);

  return { alerts, isLoading: status === "loading", isReady: status === "succeeded" };
}
