"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchDoctorPatients,
  fetchDoctorPatient,
  fetchPatientResult,
  selectDoctorPatients,
  selectDoctorPatientsTotal,
  selectDoctorPatientsStatus,
  selectDoctorPatientDetail,
  selectPatientResults,
} from "@/store/slices/doctorsSlice";
import {
  fetchPatientPermissions,
  selectPatientPermissions,
} from "@/store/slices/permissionsSlice";
import {
  fetchMyAlerts,
  selectMyAlerts,
  selectAlertsStatus,
} from "@/store/slices/alertsSlice";

export function useDoctorPatients(params?: { page?: number; limit?: number; search?: string }) {
  const dispatch = useAppDispatch();
  const patients = useAppSelector(selectDoctorPatients);
  const total    = useAppSelector(selectDoctorPatientsTotal);
  const status   = useAppSelector(selectDoctorPatientsStatus);
  const { page, limit, search } = params ?? {};

  useEffect(() => {
    dispatch(fetchDoctorPatients(params));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, page, limit, search]);

  return { patients, total, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useDoctorPatient(id: string) {
  const dispatch = useAppDispatch();
  const detail   = useAppSelector(selectDoctorPatientDetail);

  useEffect(() => {
    dispatch(fetchDoctorPatient(id));
  }, [dispatch, id]);

  return detail[id] || detail.current || null;
}

export function usePatientResult(patientId: string, instanceId: string) {
  const dispatch = useAppDispatch();
  const results  = useAppSelector(selectPatientResults);

  useEffect(() => {
    dispatch(fetchPatientResult({ patientId, instanceId }));
  }, [dispatch, patientId, instanceId]);

  return results[instanceId] || null;
}

export function usePatientPermissions(patientId: string) {
  const dispatch = useAppDispatch();
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
