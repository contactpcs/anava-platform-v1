/**
 * Doctor notes slice — caches:
 * - the doctor's full notes list (own context)
 * - per-patient notes (keyed by patientId)
 *
 * Notes mutate when a doctor saves edits, so TTL is short and we expose
 * an upsert thunk that updates the cache directly without an extra fetch.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { doctorNotesService, type DoctorNote } from "@/lib/api/services/doctorNotes.service";
import type { RootState } from "../store";

const TTL_MS = 2 * 60 * 1000; // 2 minutes

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PatientNoteEntry {
  note: DoctorNote | null;
  status: LoadStatus;
  loadedAt: number | null;
}

interface DoctorNotesState {
  myNotes: DoctorNote[];
  myNotesStatus: LoadStatus;
  myNotesLoadedAt: number | null;

  byPatientId: Record<string, PatientNoteEntry>;
}

const initialState: DoctorNotesState = {
  myNotes: [],
  myNotesStatus: "idle",
  myNotesLoadedAt: null,
  byPatientId: {},
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < TTL_MS;
}

export const fetchMyNotes = createAsyncThunk<
  DoctorNote[],
  void,
  { state: RootState }
>(
  "doctorNotes/fetchMine",
  async () => doctorNotesService.getMyNotes(),
  {
    condition: (_, { getState }) => {
      const { myNotesStatus, myNotesLoadedAt } = getState().doctorNotes;
      if (myNotesStatus === "loading") return false;
      if (myNotesStatus === "succeeded" && isFresh(myNotesLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchPatientNote = createAsyncThunk<
  { patientId: string; note: DoctorNote | null },
  string,
  { state: RootState }
>(
  "doctorNotes/fetchForPatient",
  async (patientId) => {
    const note = await doctorNotesService.getForPatient(patientId);
    return { patientId, note };
  },
  {
    condition: (patientId, { getState }) => {
      const entry = getState().doctorNotes.byPatientId[patientId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt)) return false;
      return true;
    },
  },
);

export const upsertPatientNote = createAsyncThunk<
  { patientId: string; note: DoctorNote },
  { patientId: string; noteText: string }
>(
  "doctorNotes/upsertForPatient",
  async ({ patientId, noteText }) => {
    const note = await doctorNotesService.upsertForPatient(patientId, noteText);
    return { patientId, note };
  },
);

const doctorNotesSlice = createSlice({
  name: "doctorNotes",
  initialState,
  reducers: {
    invalidateMyNotes: (state) => {
      state.myNotesLoadedAt = null;
      state.myNotesStatus = "idle";
    },
    invalidatePatientNote: (state, action: { payload: string }) => {
      delete state.byPatientId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyNotes.pending, (s) => { s.myNotesStatus = "loading"; })
      .addCase(fetchMyNotes.fulfilled, (s, a) => {
        s.myNotesStatus = "succeeded";
        s.myNotes = a.payload;
        s.myNotesLoadedAt = Date.now();
      })
      .addCase(fetchMyNotes.rejected, (s) => { s.myNotesStatus = "failed"; })

      .addCase(fetchPatientNote.pending, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { note: null, loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchPatientNote.fulfilled, (s, a) => {
        s.byPatientId[a.payload.patientId] = {
          note: a.payload.note,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchPatientNote.rejected, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { note: null, loadedAt: null }),
          status: "failed",
        } as PatientNoteEntry;
      })

      .addCase(upsertPatientNote.fulfilled, (s, a) => {
        // Cache-through on save: avoid an extra GET after PUT.
        s.byPatientId[a.payload.patientId] = {
          note: a.payload.note,
          status: "succeeded",
          loadedAt: Date.now(),
        };
        s.myNotesLoadedAt = null;
        s.myNotesStatus = "idle";
      });
  },
});

export const { invalidateMyNotes, invalidatePatientNote } = doctorNotesSlice.actions;
export default doctorNotesSlice.reducer;

export const selectMyDoctorNotes       = (s: RootState) => s.doctorNotes.myNotes;
export const selectMyDoctorNotesStatus = (s: RootState) => s.doctorNotes.myNotesStatus;
export const selectPatientNote         = (patientId: string) => (s: RootState) => s.doctorNotes.byPatientId[patientId];
