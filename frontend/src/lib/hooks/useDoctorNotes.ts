"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchMyNotes,
  fetchPatientNote,
  upsertPatientNote,
  selectMyDoctorNotes,
  selectMyDoctorNotesStatus,
  selectPatientNote,
} from "@/store/slices/doctorNotesSlice";

export function useMyDoctorNotes() {
  const dispatch = useAppDispatch();
  const notes    = useAppSelector(selectMyDoctorNotes);
  const status   = useAppSelector(selectMyDoctorNotesStatus);

  useEffect(() => {
    dispatch(fetchMyNotes());
  }, [dispatch]);

  return { notes, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function usePatientNote(patientId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientNote(patientId));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientNote(patientId));
  }, [dispatch, patientId]);

  const save = useCallback(
    (noteText: string) => dispatch(upsertPatientNote({ patientId, noteText })),
    [dispatch, patientId],
  );

  return {
    note: entry?.note ?? null,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
    save,
  };
}
