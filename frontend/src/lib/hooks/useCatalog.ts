"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchScales,
  fetchClinics,
  selectScales,
  selectScalesById,
  selectScalesStatus,
  selectClinics,
  selectClinicsStatus,
} from "@/store/slices/catalogSlice";

/**
 * Reads cached scales from the store and triggers a fetch on mount. The thunk
 * itself short-circuits when the cache is still fresh, so calling this from
 * many pages causes at most one network request per session.
 *
 * Returns both the array (for iteration) and a lookup map keyed by scale_id
 * (for O(1) name resolution against responses).
 */
export function useScales() {
  const dispatch = useAppDispatch();
  const scales   = useAppSelector(selectScales);
  const byId     = useAppSelector(selectScalesById);
  const status   = useAppSelector(selectScalesStatus);

  useEffect(() => {
    dispatch(fetchScales());
  }, [dispatch]);

  return {
    scales,
    scalesById: byId,
    isLoading: status === "loading" && scales.length === 0,
    isReady:   status === "succeeded",
  };
}

/** Same pattern as useScales, but for the clinic registry. */
export function useClinics() {
  const dispatch = useAppDispatch();
  const clinics  = useAppSelector(selectClinics);
  const status   = useAppSelector(selectClinicsStatus);

  useEffect(() => {
    dispatch(fetchClinics());
  }, [dispatch]);

  return {
    clinics,
    isLoading: status === "loading" && clinics.length === 0,
    isReady:   status === "succeeded",
  };
}
