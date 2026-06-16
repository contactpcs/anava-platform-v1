"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchAnamnesisQuestions,
  fetchMyAnamnesis,
  fetchPatientAnamnesis,
  selectAnamnesisQuestions,
  selectAnamnesisQuestionsStatus,
  selectMyAnamnesis,
  selectMyAnamnesisStatus,
  selectPatientAnamnesis,
} from "@/store/slices/anamnesisSlice";

export function useAnamnesisQuestions() {
  const dispatch  = useAppDispatch();
  const questions = useAppSelector(selectAnamnesisQuestions);
  const status    = useAppSelector(selectAnamnesisQuestionsStatus);

  useEffect(() => {
    dispatch(fetchAnamnesisQuestions());
  }, [dispatch]);

  return { questions, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useMyAnamnesis() {
  const dispatch = useAppDispatch();
  const record   = useAppSelector(selectMyAnamnesis);
  const status   = useAppSelector(selectMyAnamnesisStatus);

  useEffect(() => {
    dispatch(fetchMyAnamnesis());
  }, [dispatch]);

  return { record, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function usePatientAnamnesis(patientId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientAnamnesis(patientId));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientAnamnesis(patientId));
  }, [dispatch, patientId]);

  return {
    record: entry?.record ?? null,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
  };
}
