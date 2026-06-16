"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPatientDashboard,
  fetchMyDoctor,
  fetchMyAssessments,
  selectPatientDashboard,
  selectPatientDashboardStatus,
  selectMyDoctor,
  selectMyDoctorStatus,
  selectMyAssessments,
  selectMyAssessmentsStatus,
} from "@/store/slices/patientsSlice";

export function usePatientDashboard() {
  const dispatch = useAppDispatch();
  const dashboard = useAppSelector(selectPatientDashboard);
  const status    = useAppSelector(selectPatientDashboardStatus);

  useEffect(() => {
    dispatch(fetchPatientDashboard());
  }, [dispatch]);

  return { dashboard, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useMyDoctor() {
  const dispatch = useAppDispatch();
  const doctor = useAppSelector(selectMyDoctor);
  const status = useAppSelector(selectMyDoctorStatus);

  useEffect(() => {
    dispatch(fetchMyDoctor());
  }, [dispatch]);

  return { doctor, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useMyAssessments() {
  const dispatch = useAppDispatch();
  const assessments = useAppSelector(selectMyAssessments);
  const status      = useAppSelector(selectMyAssessmentsStatus);

  useEffect(() => {
    dispatch(fetchMyAssessments());
  }, [dispatch]);

  return { assessments, isLoading: status === "loading", isReady: status === "succeeded" };
}
