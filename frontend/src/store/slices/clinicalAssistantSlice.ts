import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { clinicalAssistantService } from "@/lib/api/services";
import type { PatientListItem } from "@/types/domain.types";
import type { RootState } from "../store";

const CA_TTL_MS = 5 * 60 * 1000;

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface ClinicalAssistantState {
  patients: PatientListItem[];
  patientsTotal: number;
  patientsStatus: LoadStatus;
  patientsLoadedAt: number | null;
  patientsError: string | null;

  patientDetail: Record<string, any>;
  patientDetailStatus: LoadStatus;
  patientDetailError: string | null;

  results: Record<string, any>;
  resultsStatus: Record<string, LoadStatus>;
  resultsError: Record<string, string | null>;
}

const initialState: ClinicalAssistantState = {
  patients: [],
  patientsTotal: 0,
  patientsStatus: "idle",
  patientsLoadedAt: null,
  patientsError: null,

  patientDetail: {},
  patientDetailStatus: "idle",
  patientDetailError: null,

  results: {},
  resultsStatus: {},
  resultsError: {},
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < CA_TTL_MS;
}

type PatientQueryParams = { page?: number; limit?: number; search?: string };

export const fetchCAPatients = createAsyncThunk<
  { patients: PatientListItem[]; total: number },
  PatientQueryParams | undefined,
  { state: RootState }
>(
  "clinicalAssistant/fetchPatients",
  async (params) => clinicalAssistantService.getPatients(params),
  {
    condition: (params, { getState }) => {
      if (params?.page !== undefined || params?.limit !== undefined || params?.search !== undefined) return true;
      const { patientsStatus, patientsLoadedAt } = getState().clinicalAssistant;
      if (patientsStatus === "loading") return false;
      if (patientsStatus === "succeeded" && isFresh(patientsLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchCAPatient = createAsyncThunk<any, string>(
  "clinicalAssistant/fetchPatient",
  async (id: string) => clinicalAssistantService.getPatient(id),
);

export const fetchCAPatientResult = createAsyncThunk<
  any,
  { patientId: string; instanceId: string }
>(
  "clinicalAssistant/fetchPatientResult",
  async ({ patientId, instanceId }) =>
    clinicalAssistantService.getPatientResult(patientId, instanceId),
);

const clinicalAssistantSlice = createSlice({
  name: "clinicalAssistant",
  initialState,
  reducers: {
    invalidateCAPatients: (state) => {
      state.patientsLoadedAt = null;
      state.patientsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCAPatients.pending, (state) => {
        state.patientsStatus = "loading";
        state.patientsError = null;
      })
      .addCase(fetchCAPatients.fulfilled, (state, action) => {
        state.patientsStatus = "succeeded";
        state.patients = action.payload.patients;
        state.patientsTotal = action.payload.total;
        state.patientsLoadedAt = Date.now();
      })
      .addCase(fetchCAPatients.rejected, (state, action) => {
        state.patientsStatus = "failed";
        state.patientsError = action.error.message ?? "Failed to load patients";
      })
      .addCase(fetchCAPatient.pending, (state) => {
        state.patientDetailStatus = "loading";
        state.patientDetailError = null;
      })
      .addCase(fetchCAPatient.fulfilled, (state, action: PayloadAction<any>) => {
        state.patientDetailStatus = "succeeded";
        state.patientDetail[action.payload.id || "current"] = action.payload;
      })
      .addCase(fetchCAPatient.rejected, (state, action) => {
        state.patientDetailStatus = "failed";
        state.patientDetailError = action.error.message ?? "Failed to load patient";
      })
      .addCase(fetchCAPatientResult.pending, (state, action) => {
        const key = action.meta.arg.instanceId;
        state.resultsStatus[key] = "loading";
        state.resultsError[key] = null;
      })
      .addCase(fetchCAPatientResult.fulfilled, (state, action: PayloadAction<any, string, { arg: { patientId: string; instanceId: string } }>) => {
        const key = action.meta.arg.instanceId;
        state.results[key] = action.payload;
        state.resultsStatus[key] = "succeeded";
      })
      .addCase(fetchCAPatientResult.rejected, (state, action) => {
        const key = action.meta.arg.instanceId;
        state.resultsStatus[key] = "failed";
        state.resultsError[key] = action.error.message ?? "Failed to load result";
      });
  },
});

export const { invalidateCAPatients } = clinicalAssistantSlice.actions;
export default clinicalAssistantSlice.reducer;

export const selectCAPatients       = (s: RootState) => s.clinicalAssistant.patients;
export const selectCAPatientsTotal  = (s: RootState) => s.clinicalAssistant.patientsTotal;
export const selectCAPatientsStatus = (s: RootState) => s.clinicalAssistant.patientsStatus;
export const selectCAPatientDetail  = (s: RootState) => s.clinicalAssistant.patientDetail;
export const selectCAResults        = (s: RootState) => s.clinicalAssistant.results;
export const selectCAResultStatus   = (instanceId: string) => (s: RootState) =>
  s.clinicalAssistant.resultsStatus[instanceId] ?? "idle";
