/**
 * Scores slice — caches assessment scores at multiple granularities:
 * - my scores list and summary (current patient context)
 * - per-instance scores (keyed by instanceId)
 * - per-patient scores list and summary (keyed by patientId)
 *
 * Per-entity caches let multiple components share the same fetch results
 * across navigation without re-hitting the API.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { scoresService, type InstanceScoreDetail } from "@/lib/api/services/scores.service";
import type { AssessmentInstance } from "@/types/domain.types";
import type { RootState } from "../store";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PatientScoresEntry {
  instances: AssessmentInstance[];
  total: number;
  status: LoadStatus;
  loadedAt: number | null;
}

interface PatientSummaryEntry {
  instances: AssessmentInstance[];
  total: number;
  diseases: number;
  status: LoadStatus;
  loadedAt: number | null;
}

interface InstanceScoreEntry {
  detail: InstanceScoreDetail | null;
  status: LoadStatus;
  loadedAt: number | null;
}

interface ScoresState {
  myScores: AssessmentInstance[];
  myScoresTotal: number;
  myScoresStatus: LoadStatus;
  myScoresLoadedAt: number | null;

  myScoresSummary: { instances: AssessmentInstance[]; total: number; diseases: number } | null;
  myScoresSummaryStatus: LoadStatus;
  myScoresSummaryLoadedAt: number | null;

  byInstanceId: Record<string, InstanceScoreEntry>;
  byPatientId: Record<string, PatientScoresEntry>;
  summaryByPatientId: Record<string, PatientSummaryEntry>;
}

const initialState: ScoresState = {
  myScores: [],
  myScoresTotal: 0,
  myScoresStatus: "idle",
  myScoresLoadedAt: null,

  myScoresSummary: null,
  myScoresSummaryStatus: "idle",
  myScoresSummaryLoadedAt: null,

  byInstanceId: {},
  byPatientId: {},
  summaryByPatientId: {},
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < TTL_MS;
}

export const fetchMyScores = createAsyncThunk<
  { instances: AssessmentInstance[]; total: number },
  void,
  { state: RootState }
>(
  "scores/fetchMyScores",
  async () => scoresService.getMyScores(),
  {
    condition: (_, { getState }) => {
      const { myScoresStatus, myScoresLoadedAt } = getState().scores;
      if (myScoresStatus === "loading") return false;
      if (myScoresStatus === "succeeded" && isFresh(myScoresLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchMyScoresSummary = createAsyncThunk<
  { instances: AssessmentInstance[]; total: number; diseases: number },
  void,
  { state: RootState }
>(
  "scores/fetchMyScoresSummary",
  async () => scoresService.getMyScoresSummary(),
  {
    condition: (_, { getState }) => {
      const { myScoresSummaryStatus, myScoresSummaryLoadedAt } = getState().scores;
      if (myScoresSummaryStatus === "loading") return false;
      if (myScoresSummaryStatus === "succeeded" && isFresh(myScoresSummaryLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchInstanceScore = createAsyncThunk<
  { instanceId: string; detail: InstanceScoreDetail },
  string,
  { state: RootState }
>(
  "scores/fetchInstanceScore",
  async (instanceId) => {
    const detail = await scoresService.getInstanceScore(instanceId);
    return { instanceId, detail };
  },
  {
    condition: (instanceId, { getState }) => {
      const entry = getState().scores.byInstanceId[instanceId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt)) return false;
      return true;
    },
  },
);

export const fetchPatientScores = createAsyncThunk<
  { patientId: string; instances: AssessmentInstance[]; total: number },
  string,
  { state: RootState }
>(
  "scores/fetchPatientScores",
  async (patientId) => {
    const result = await scoresService.getPatientScores(patientId);
    return { patientId, ...result };
  },
  {
    condition: (patientId, { getState }) => {
      const entry = getState().scores.byPatientId[patientId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt)) return false;
      return true;
    },
  },
);

export const fetchPatientScoresSummary = createAsyncThunk<
  { patientId: string; instances: AssessmentInstance[]; total: number; diseases: number },
  string,
  { state: RootState }
>(
  "scores/fetchPatientScoresSummary",
  async (patientId) => {
    const result = await scoresService.getPatientScoresSummary(patientId);
    return { patientId, ...result };
  },
  {
    condition: (patientId, { getState }) => {
      const entry = getState().scores.summaryByPatientId[patientId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt)) return false;
      return true;
    },
  },
);

const scoresSlice = createSlice({
  name: "scores",
  initialState,
  reducers: {
    invalidateMyScores: (state) => {
      state.myScoresLoadedAt = null;
      state.myScoresStatus = "idle";
      state.myScoresSummaryLoadedAt = null;
      state.myScoresSummaryStatus = "idle";
    },
    invalidatePatientScores: (state, action: { payload: string }) => {
      delete state.byPatientId[action.payload];
      delete state.summaryByPatientId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyScores.pending, (s) => { s.myScoresStatus = "loading"; })
      .addCase(fetchMyScores.fulfilled, (s, a) => {
        s.myScoresStatus = "succeeded";
        s.myScores = a.payload.instances;
        s.myScoresTotal = a.payload.total;
        s.myScoresLoadedAt = Date.now();
      })
      .addCase(fetchMyScores.rejected, (s) => { s.myScoresStatus = "failed"; })

      .addCase(fetchMyScoresSummary.pending, (s) => { s.myScoresSummaryStatus = "loading"; })
      .addCase(fetchMyScoresSummary.fulfilled, (s, a) => {
        s.myScoresSummaryStatus = "succeeded";
        s.myScoresSummary = a.payload;
        s.myScoresSummaryLoadedAt = Date.now();
      })
      .addCase(fetchMyScoresSummary.rejected, (s) => { s.myScoresSummaryStatus = "failed"; })

      .addCase(fetchInstanceScore.pending, (s, a) => {
        s.byInstanceId[a.meta.arg] = {
          ...(s.byInstanceId[a.meta.arg] || { detail: null, loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchInstanceScore.fulfilled, (s, a) => {
        s.byInstanceId[a.payload.instanceId] = {
          detail: a.payload.detail,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchInstanceScore.rejected, (s, a) => {
        s.byInstanceId[a.meta.arg] = {
          ...(s.byInstanceId[a.meta.arg] || { detail: null, loadedAt: null }),
          status: "failed",
        } as InstanceScoreEntry;
      })

      .addCase(fetchPatientScores.pending, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { instances: [], total: 0, loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchPatientScores.fulfilled, (s, a) => {
        s.byPatientId[a.payload.patientId] = {
          instances: a.payload.instances,
          total: a.payload.total,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchPatientScores.rejected, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { instances: [], total: 0, loadedAt: null }),
          status: "failed",
        } as PatientScoresEntry;
      })

      .addCase(fetchPatientScoresSummary.pending, (s, a) => {
        s.summaryByPatientId[a.meta.arg] = {
          ...(s.summaryByPatientId[a.meta.arg] || { instances: [], total: 0, diseases: 0, loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchPatientScoresSummary.fulfilled, (s, a) => {
        s.summaryByPatientId[a.payload.patientId] = {
          instances: a.payload.instances,
          total: a.payload.total,
          diseases: a.payload.diseases,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchPatientScoresSummary.rejected, (s, a) => {
        s.summaryByPatientId[a.meta.arg] = {
          ...(s.summaryByPatientId[a.meta.arg] || { instances: [], total: 0, diseases: 0, loadedAt: null }),
          status: "failed",
        } as PatientSummaryEntry;
      });
  },
});

export const { invalidateMyScores, invalidatePatientScores } = scoresSlice.actions;
export default scoresSlice.reducer;

export const selectMyScores             = (s: RootState) => s.scores.myScores;
export const selectMyScoresStatus       = (s: RootState) => s.scores.myScoresStatus;
export const selectMyScoresSummary      = (s: RootState) => s.scores.myScoresSummary;
export const selectMyScoresSummaryStatus = (s: RootState) => s.scores.myScoresSummaryStatus;
export const selectInstanceScore        = (instanceId: string) => (s: RootState) => s.scores.byInstanceId[instanceId];
export const selectPatientScores        = (patientId: string) => (s: RootState) => s.scores.byPatientId[patientId];
export const selectPatientScoresSummary = (patientId: string) => (s: RootState) => s.scores.summaryByPatientId[patientId];
