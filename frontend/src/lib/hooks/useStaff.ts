"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchDashboard,
  fetchPatients,
  fetchPendingPatients,
  fetchPatient,
  selectDashboard,
  selectDashboardStatus,
  selectPatients,
  selectPatientsStatus,
  selectPendingPatients,
  selectPendingStatus,
  selectPatientDetail,
} from "@/store/slices/staffSlice";

export function useStaffDashboard() {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector(selectDashboard);
  const status    = useAppSelector(selectDashboardStatus);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  return { dashboard, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useStaffPatients() {
  const dispatch = useAppDispatch();
  const patients = useAppSelector(selectPatients);
  const status   = useAppSelector(selectPatientsStatus);

  useEffect(() => {
    dispatch(fetchPatients());
  }, [dispatch]);

  return { patients, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useStaffPendingPatients() {
  const dispatch = useAppDispatch();
  const pending  = useAppSelector(selectPendingPatients);
  const status   = useAppSelector(selectPendingStatus);

  useEffect(() => {
    dispatch(fetchPendingPatients());
  }, [dispatch]);

  return { pending, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useStaffPatient(id: string) {
  const dispatch = useAppDispatch();
  const patient  = useAppSelector(selectPatientDetail);

  useEffect(() => {
    dispatch(fetchPatient(id));
  }, [dispatch, id]);

  return patient;
}
