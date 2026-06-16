"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchMyScores,
  fetchMyScoresSummary,
  fetchInstanceScore,
  fetchPatientScores,
  fetchPatientScoresSummary,
  selectMyScores,
  selectMyScoresStatus,
  selectMyScoresSummary,
  selectMyScoresSummaryStatus,
  selectInstanceScore,
  selectPatientScores,
  selectPatientScoresSummary,
} from "@/store/slices/scoresSlice";

export function useMyScores() {
  const dispatch = useAppDispatch();
  const scores   = useAppSelector(selectMyScores);
  const status   = useAppSelector(selectMyScoresStatus);

  useEffect(() => {
    dispatch(fetchMyScores());
  }, [dispatch]);

  return { scores, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useMyScoresSummary() {
  const dispatch = useAppDispatch();
  const summary  = useAppSelector(selectMyScoresSummary);
  const status   = useAppSelector(selectMyScoresSummaryStatus);

  useEffect(() => {
    dispatch(fetchMyScoresSummary());
  }, [dispatch]);

  return { summary, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useInstanceScore(instanceId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectInstanceScore(instanceId));

  useEffect(() => {
    if (instanceId) dispatch(fetchInstanceScore(instanceId));
  }, [dispatch, instanceId]);

  return {
    detail: entry?.detail ?? null,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
  };
}

export function usePatientScores(patientId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientScores(patientId));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientScores(patientId));
  }, [dispatch, patientId]);

  return {
    instances: entry?.instances ?? [],
    total: entry?.total ?? 0,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
  };
}

export function usePatientScoresSummary(patientId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientScoresSummary(patientId));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientScoresSummary(patientId));
  }, [dispatch, patientId]);

  return {
    instances: entry?.instances ?? [],
    total: entry?.total ?? 0,
    diseases: entry?.diseases ?? 0,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
  };
}
