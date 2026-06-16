"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMySessions, fetchSession, fetchScales, fetchPatientSessions, createSession, clearCurrentCondition } from "@/store/slices/sessionSlice";
import { fetchConditions, selectConditions } from "@/store/slices/catalogSlice";

export function useSessions() {
  const dispatch = useAppDispatch();
  const { sessions, currentSession, currentCondition, scales, isLoading, error } = useAppSelector((s: RootState) => s.session);
  // Pull conditions from catalog (single source of truth for this static ref data)
  const conditions = useAppSelector(selectConditions);

  const loadMySessions = useCallback(() => { dispatch(fetchMySessions()); }, [dispatch]);
  const loadSession = useCallback((id: string) => { dispatch(fetchSession(id)); }, [dispatch]);
  const loadConditions = useCallback(() => { dispatch(fetchConditions()); }, [dispatch]);
  const loadScales = useCallback(() => { dispatch(fetchScales()); }, [dispatch]);
  const loadPatientSessions = useCallback((patientId: string) => { dispatch(fetchPatientSessions(patientId)); }, [dispatch]);

  // Load condition detail by fetching from catalog (now just returns what's in conditions)
  const loadConditionDetail = useCallback((conditionId: string) => {
    // For now, just fetch conditions and let the caller extract by ID. This is fine since
    // conditions are small and static. In future, could add per-condition fetch.
    dispatch(fetchConditions());
  }, [dispatch]);

  const resetConditionDetail = useCallback(() => { dispatch(clearCurrentCondition()); }, [dispatch]);

  const assignSession = useCallback(async (payload: Parameters<typeof createSession>[0]) => {
    return dispatch(createSession(payload));
  }, [dispatch]);

  const pendingSessions = sessions.filter(s => s.status === "assigned");
  const inProgressSessions = sessions.filter(s => s.status === "in_progress");
  const completedSessions = sessions.filter(s => s.status === "completed");

  return {
    sessions, currentSession, conditions, currentCondition, scales, isLoading, error,
    pendingSessions, inProgressSessions, completedSessions,
    loadMySessions, loadSession, loadConditions, loadScales, loadPatientSessions,
    loadConditionDetail, resetConditionDetail,
    assignSession,
  };
}
