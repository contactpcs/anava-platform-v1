/**
 * Doctors slice — caches doctor-scoped data: patients list, individual patient
 * detail, and assessment results. TTL is moderate (5 min) since this data
 * changes more frequently than static refs but less than transactional data.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { doctorsService } from "@/lib/api/services";
import type { PatientListItem } from "@/types/domain.types";
import type { RootState } from "../store";

const DOCTORS_TTL_MS = 5 * 60 * 1000; // 5 min

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface DoctorsState {
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

const initialState: DoctorsState = {
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
  return loadedAt !== null && Date.now() - loadedAt < DOCTORS_TTL_MS;
}

type PatientQueryParams = { page?: number; limit?: number; search?: string };

export const fetchDoctorPatients = createAsyncThunk<
  { patients: PatientListItem[]; total: number },
  PatientQueryParams | undefined,
  { state: RootState }
>(
  "doctors/fetchPatients",
  async (params) => doctorsService.getPatients(params),
  {
    condition: (params, { getState }) => {
      // Bypass TTL when explicit pagination/search params are provided
      if (params?.page !== undefined || params?.limit !== undefined || params?.search !== undefined) return true;
      const { patientsStatus, patientsLoadedAt } = getState().doctors;
      if (patientsStatus === "loading") return false;
      if (patientsStatus === "succeeded" && isFresh(patientsLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchDoctorPatient = createAsyncThunk<any, string>(
  "doctors/fetchPatient",
  async (id: string) => doctorsService.getPatient(id),
);

export const fetchPatientResult = createAsyncThunk<
  any,
  { patientId: string; instanceId: string }
>(
  "doctors/fetchPatientResult",
  async ({ patientId, instanceId }) =>
    doctorsService.getPatientResult(patientId, instanceId),
);

const doctorsSlice = createSlice({
  name: "doctors",
  initialState,
  reducers: {
    invalidateDoctorPatients: (state) => {
      state.patientsLoadedAt = null;
      state.patientsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDoctorPatients.pending, (state) => {
        state.patientsStatus = "loading";
        state.patientsError = null;
      })
      .addCase(fetchDoctorPatients.fulfilled, (state, action) => {
        state.patientsStatus = "succeeded";
        state.patients = action.payload.patients;
        state.patientsTotal = action.payload.total;
        state.patientsLoadedAt = Date.now();
      })
      .addCase(fetchDoctorPatients.rejected, (state, action) => {
        state.patientsStatus = "failed";
        state.patientsError = action.error.message ?? "Failed to load patients";
      })
      .addCase(fetchDoctorPatient.pending, (state) => {
        state.patientDetailStatus = "loading";
        state.patientDetailError = null;
      })
      .addCase(
        fetchDoctorPatient.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.patientDetailStatus = "succeeded";
          state.patientDetail[action.payload.id || "current"] = action.payload;
        }
      )
      .addCase(fetchDoctorPatient.rejected, (state, action) => {
        state.patientDetailStatus = "failed";
        state.patientDetailError = action.error.message ?? "Failed to load patient";
      })
      .addCase(fetchPatientResult.pending, (state, action) => {
        const key = action.meta.arg.instanceId;
        state.resultsStatus[key] = "loading";
        state.resultsError[key] = null;
      })
      .addCase(
        fetchPatientResult.fulfilled,
        (state, action: PayloadAction<any, string, { arg: { patientId: string; instanceId: string } }>) => {
          const key = action.meta.arg.instanceId;
          state.results[key] = action.payload;
          state.resultsStatus[key] = "succeeded";
        }
      )
      .addCase(fetchPatientResult.rejected, (state, action) => {
        const key = action.meta.arg.instanceId;
        state.resultsStatus[key] = "failed";
        state.resultsError[key] = action.error.message ?? "Failed to load result";
      });
  },
});

export const { invalidateDoctorPatients } = doctorsSlice.actions;
export default doctorsSlice.reducer;

export const selectDoctorPatients       = (s: RootState) => s.doctors.patients;
export const selectDoctorPatientsTotal  = (s: RootState) => s.doctors.patientsTotal;
export const selectDoctorPatientsStatus = (s: RootState) => s.doctors.patientsStatus;
export const selectDoctorPatientDetail = (s: RootState) => s.doctors.patientDetail;
export const selectPatientResults = (s: RootState) => s.doctors.results;
export const selectPatientResultStatus = (instanceId: string) => (s: RootState) =>
  s.doctors.resultsStatus[instanceId] ?? "idle";
export const selectPatientResultError = (instanceId: string) => (s: RootState) =>
  s.doctors.resultsError[instanceId] ?? null;
