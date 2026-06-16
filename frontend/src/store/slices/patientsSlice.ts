/**
 * Patients slice — caches the patient-side dashboard, assigned-doctor, and
 * assigned-assessments data with TTL-based gating to eliminate redundant
 * fetches when the same patient navigates between pages.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { patientsService } from "@/lib/api/services";
import type { PatientDashboard, AssessmentPermission } from "@/types/domain.types";
import type { RootState } from "../store";

const TTL_MS = 5 * 60 * 1000; // 5 minutes

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

type MyDoctor = { id: string; first_name: string; last_name: string; specialization?: string; phone?: string };

interface PatientsState {
  dashboard: PatientDashboard | null;
  dashboardStatus: LoadStatus;
  dashboardLoadedAt: number | null;
  dashboardError: string | null;

  myDoctor: MyDoctor | null;
  myDoctorStatus: LoadStatus;
  myDoctorLoadedAt: number | null;
  myDoctorError: string | null;

  myAssessments: AssessmentPermission[];
  myAssessmentsStatus: LoadStatus;
  myAssessmentsLoadedAt: number | null;
  myAssessmentsError: string | null;
}

const initialState: PatientsState = {
  dashboard: null,
  dashboardStatus: "idle",
  dashboardLoadedAt: null,
  dashboardError: null,

  myDoctor: null,
  myDoctorStatus: "idle",
  myDoctorLoadedAt: null,
  myDoctorError: null,

  myAssessments: [],
  myAssessmentsStatus: "idle",
  myAssessmentsLoadedAt: null,
  myAssessmentsError: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < TTL_MS;
}

export const fetchPatientDashboard = createAsyncThunk<
  PatientDashboard,
  void,
  { state: RootState }
>(
  "patients/fetchDashboard",
  async () => patientsService.getDashboard(),
  {
    condition: (_, { getState }) => {
      const { dashboardStatus, dashboardLoadedAt } = getState().patients;
      if (dashboardStatus === "loading") return false;
      if (dashboardStatus === "succeeded" && isFresh(dashboardLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchMyDoctor = createAsyncThunk<
  MyDoctor,
  void,
  { state: RootState }
>(
  "patients/fetchMyDoctor",
  async () => patientsService.getMyDoctor(),
  {
    condition: (_, { getState }) => {
      const { myDoctorStatus, myDoctorLoadedAt } = getState().patients;
      if (myDoctorStatus === "loading") return false;
      if (myDoctorStatus === "succeeded" && isFresh(myDoctorLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchMyAssessments = createAsyncThunk<
  { permissions: AssessmentPermission[]; total: number },
  void,
  { state: RootState }
>(
  "patients/fetchMyAssessments",
  async () => patientsService.getMyAssessments(),
  {
    condition: (_, { getState }) => {
      const { myAssessmentsStatus, myAssessmentsLoadedAt } = getState().patients;
      if (myAssessmentsStatus === "loading") return false;
      if (myAssessmentsStatus === "succeeded" && isFresh(myAssessmentsLoadedAt)) return false;
      return true;
    },
  },
);

const patientsSlice = createSlice({
  name: "patients",
  initialState,
  reducers: {
    invalidateDashboard: (state) => {
      state.dashboardLoadedAt = null;
      state.dashboardStatus = "idle";
    },
    invalidateMyAssessments: (state) => {
      state.myAssessmentsLoadedAt = null;
      state.myAssessmentsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientDashboard.pending, (s) => { s.dashboardStatus = "loading"; s.dashboardError = null; })
      .addCase(fetchPatientDashboard.fulfilled, (s, a) => {
        s.dashboardStatus = "succeeded";
        s.dashboard = a.payload;
        s.dashboardLoadedAt = Date.now();
      })
      .addCase(fetchPatientDashboard.rejected, (s, a) => {
        s.dashboardStatus = "failed";
        s.dashboardError = a.error.message ?? "Failed to load dashboard";
      })
      .addCase(fetchMyDoctor.pending, (s) => { s.myDoctorStatus = "loading"; s.myDoctorError = null; })
      .addCase(fetchMyDoctor.fulfilled, (s, a) => {
        s.myDoctorStatus = "succeeded";
        s.myDoctor = a.payload;
        s.myDoctorLoadedAt = Date.now();
      })
      .addCase(fetchMyDoctor.rejected, (s, a) => {
        s.myDoctorStatus = "failed";
        s.myDoctorError = a.error.message ?? "Failed to load doctor";
      })
      .addCase(fetchMyAssessments.pending, (s) => { s.myAssessmentsStatus = "loading"; s.myAssessmentsError = null; })
      .addCase(fetchMyAssessments.fulfilled, (s, a) => {
        s.myAssessmentsStatus = "succeeded";
        s.myAssessments = a.payload.permissions;
        s.myAssessmentsLoadedAt = Date.now();
      })
      .addCase(fetchMyAssessments.rejected, (s, a) => {
        s.myAssessmentsStatus = "failed";
        s.myAssessmentsError = a.error.message ?? "Failed to load assessments";
      });
  },
});

export const { invalidateDashboard, invalidateMyAssessments } = patientsSlice.actions;
export default patientsSlice.reducer;

export const selectPatientDashboard       = (s: RootState) => s.patients.dashboard;
export const selectPatientDashboardStatus = (s: RootState) => s.patients.dashboardStatus;
export const selectMyDoctor               = (s: RootState) => s.patients.myDoctor;
export const selectMyDoctorStatus         = (s: RootState) => s.patients.myDoctorStatus;
export const selectMyAssessments          = (s: RootState) => s.patients.myAssessments;
export const selectMyAssessmentsStatus    = (s: RootState) => s.patients.myAssessmentsStatus;
