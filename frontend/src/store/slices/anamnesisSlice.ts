/**
 * Anamnesis slice — caches:
 * - the static questions catalog (long TTL: questions are reference data)
 * - the current user's anamnesis record
 * - per-patient anamnesis records (keyed by patientId, used by doctors)
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { anamnesisService, type AnamnesisQuestion } from "@/lib/api/services/anamnesis.service";
import type { AnamnesisRecord } from "@/types/domain.types";
import type { RootState } from "../store";

const QUESTIONS_TTL_MS = 30 * 60 * 1000; // 30 min — static reference data
const RECORD_TTL_MS    = 2 * 60 * 1000;  // 2 min — anamnesis records change as patient/doctor edits

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PatientAnamnesisEntry {
  record: AnamnesisRecord | null;
  status: LoadStatus;
  loadedAt: number | null;
}

interface AnamnesisState {
  questions: AnamnesisQuestion[];
  questionsStatus: LoadStatus;
  questionsLoadedAt: number | null;

  myAnamnesis: AnamnesisRecord | null;
  myAnamnesisStatus: LoadStatus;
  myAnamnesisLoadedAt: number | null;

  byPatientId: Record<string, PatientAnamnesisEntry>;
}

const initialState: AnamnesisState = {
  questions: [],
  questionsStatus: "idle",
  questionsLoadedAt: null,

  myAnamnesis: null,
  myAnamnesisStatus: "idle",
  myAnamnesisLoadedAt: null,

  byPatientId: {},
};

function isFresh(loadedAt: number | null, ttl: number): boolean {
  return loadedAt !== null && Date.now() - loadedAt < ttl;
}

export const fetchAnamnesisQuestions = createAsyncThunk<
  AnamnesisQuestion[],
  void,
  { state: RootState }
>(
  "anamnesis/fetchQuestions",
  async () => anamnesisService.getQuestions(),
  {
    condition: (_, { getState }) => {
      const { questionsStatus, questionsLoadedAt } = getState().anamnesis;
      if (questionsStatus === "loading") return false;
      if (questionsStatus === "succeeded" && isFresh(questionsLoadedAt, QUESTIONS_TTL_MS)) return false;
      return true;
    },
  },
);

export const fetchMyAnamnesis = createAsyncThunk<
  AnamnesisRecord,
  void,
  { state: RootState }
>(
  "anamnesis/fetchMine",
  async () => anamnesisService.getMyAnamnesis(),
  {
    condition: (_, { getState }) => {
      const { myAnamnesisStatus, myAnamnesisLoadedAt } = getState().anamnesis;
      if (myAnamnesisStatus === "loading") return false;
      if (myAnamnesisStatus === "succeeded" && isFresh(myAnamnesisLoadedAt, RECORD_TTL_MS)) return false;
      return true;
    },
  },
);

export const fetchPatientAnamnesis = createAsyncThunk<
  { patientId: string; record: AnamnesisRecord | null },
  string,
  { state: RootState }
>(
  "anamnesis/fetchForPatient",
  async (patientId) => {
    const record = await anamnesisService.getForPatient(patientId);
    return { patientId, record };
  },
  {
    condition: (patientId, { getState }) => {
      const entry = getState().anamnesis.byPatientId[patientId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt, RECORD_TTL_MS)) return false;
      return true;
    },
  },
);

const anamnesisSlice = createSlice({
  name: "anamnesis",
  initialState,
  reducers: {
    invalidateMyAnamnesis: (state) => {
      state.myAnamnesisLoadedAt = null;
      state.myAnamnesisStatus = "idle";
    },
    invalidatePatientAnamnesis: (state, action: { payload: string }) => {
      delete state.byPatientId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnamnesisQuestions.pending, (s) => { s.questionsStatus = "loading"; })
      .addCase(fetchAnamnesisQuestions.fulfilled, (s, a) => {
        s.questionsStatus = "succeeded";
        s.questions = a.payload;
        s.questionsLoadedAt = Date.now();
      })
      .addCase(fetchAnamnesisQuestions.rejected, (s) => { s.questionsStatus = "failed"; })

      .addCase(fetchMyAnamnesis.pending, (s) => { s.myAnamnesisStatus = "loading"; })
      .addCase(fetchMyAnamnesis.fulfilled, (s, a) => {
        s.myAnamnesisStatus = "succeeded";
        s.myAnamnesis = a.payload;
        s.myAnamnesisLoadedAt = Date.now();
      })
      .addCase(fetchMyAnamnesis.rejected, (s) => { s.myAnamnesisStatus = "failed"; })

      .addCase(fetchPatientAnamnesis.pending, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { record: null, loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchPatientAnamnesis.fulfilled, (s, a) => {
        s.byPatientId[a.payload.patientId] = {
          record: a.payload.record,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchPatientAnamnesis.rejected, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { record: null, loadedAt: null }),
          status: "failed",
        } as PatientAnamnesisEntry;
      });
  },
});

export const { invalidateMyAnamnesis, invalidatePatientAnamnesis } = anamnesisSlice.actions;
export default anamnesisSlice.reducer;

export const selectAnamnesisQuestions       = (s: RootState) => s.anamnesis.questions;
export const selectAnamnesisQuestionsStatus = (s: RootState) => s.anamnesis.questionsStatus;
export const selectMyAnamnesis              = (s: RootState) => s.anamnesis.myAnamnesis;
export const selectMyAnamnesisStatus        = (s: RootState) => s.anamnesis.myAnamnesisStatus;
export const selectPatientAnamnesis         = (patientId: string) => (s: RootState) => s.anamnesis.byPatientId[patientId];
