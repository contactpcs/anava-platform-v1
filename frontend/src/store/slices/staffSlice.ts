/**
 * Staff (receptionist) slice — caches lists and details that receptionist
 * users interact with: patients, pending registrations, their dashboard,
 * and individual patient details. Eliminates redundant fetches as users
 * navigate receptionist/dashboard → receptionist/patients → receptionist/patients/[id].
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { staffService } from "@/lib/api/services";
import type { PatientListItem, PatientDetail, StaffDashboard } from "@/types/domain.types";
import type { RootState } from "../store";
import { login, logout } from "./authSlice";

const STAFF_TTL_MS = 5 * 60 * 1000; // 5 min — patient lists change more than static refs but less than session data

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface StaffState {
  /** Tracks which clinic the cached data belongs to. */
  activeClinicId: string | null;

  dashboard: StaffDashboard | null;
  dashboardStatus: LoadStatus;
  dashboardLoadedAt: number | null;
  dashboardError: string | null;

  patients: PatientListItem[];
  patientsStatus: LoadStatus;
  patientsLoadedAt: number | null;
  patientsError: string | null;

  pendingPatients: PatientListItem[];
  pendingStatus: LoadStatus;
  pendingLoadedAt: number | null;
  pendingError: string | null;

  patientDetail: PatientDetail | null;
  patientDetailStatus: LoadStatus;
  patientDetailError: string | null;
}

const initialState: StaffState = {
  activeClinicId: null,

  dashboard: null,
  dashboardStatus: "idle",
  dashboardLoadedAt: null,
  dashboardError: null,

  patients: [],
  patientsStatus: "idle",
  patientsLoadedAt: null,
  patientsError: null,

  pendingPatients: [],
  pendingStatus: "idle",
  pendingLoadedAt: null,
  pendingError: null,

  patientDetail: null,
  patientDetailStatus: "idle",
  patientDetailError: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < STAFF_TTL_MS;
}

export const fetchDashboard = createAsyncThunk<
  StaffDashboard,
  void,
  { state: RootState }
>(
  "staff/fetchDashboard",
  async () => staffService.getDashboard(),
  {
    condition: (_, { getState }) => {
      const { dashboardStatus, dashboardLoadedAt } = getState().staff;
      if (dashboardStatus === "loading") return false;
      if (dashboardStatus === "succeeded" && isFresh(dashboardLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchPatients = createAsyncThunk<
  PatientListItem[],
  void,
  { state: RootState }
>(
  "staff/fetchPatients",
  async () => {
    const { patients } = await staffService.getPatients();
    return patients;
  },
  {
    condition: (_, { getState }) => {
      const { patientsStatus, patientsLoadedAt, activeClinicId } = getState().staff;
      const currentClinicId = getState().auth.user?.clinic_id ?? null;
      // Bypass cache if the clinic changed (different receptionist logged in)
      if (activeClinicId !== null && activeClinicId !== currentClinicId) return true;
      if (patientsStatus === "loading") return false;
      if (patientsStatus === "succeeded" && isFresh(patientsLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchPendingPatients = createAsyncThunk<
  PatientListItem[],
  void,
  { state: RootState }
>(
  "staff/fetchPendingPatients",
  async () => {
    const { patients } = await staffService.getPendingPatients();
    return patients;
  },
  {
    condition: (_, { getState }) => {
      const { pendingStatus, pendingLoadedAt, activeClinicId } = getState().staff;
      const currentClinicId = getState().auth.user?.clinic_id ?? null;
      // Bypass cache if the clinic changed
      if (activeClinicId !== null && activeClinicId !== currentClinicId) return true;
      if (pendingStatus === "loading") return false;
      if (pendingStatus === "succeeded" && isFresh(pendingLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchPatient = createAsyncThunk<PatientDetail, string>(
  "staff/fetchPatient",
  async (id: string) => staffService.getPatient(id),
);

const staffSlice = createSlice({
  name: "staff",
  initialState,
  reducers: {
    invalidateDashboard: (state) => {
      state.dashboardLoadedAt = null;
      state.dashboardStatus = "idle";
    },
    invalidatePatients: (state) => {
      state.patientsLoadedAt = null;
      state.patientsStatus = "idle";
    },
    invalidatePendingPatients: (state) => {
      state.pendingLoadedAt = null;
      state.pendingStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.dashboardStatus = "loading";
        state.dashboardError = null;
      })
      .addCase(fetchDashboard.fulfilled, (state, action: PayloadAction<StaffDashboard>) => {
        state.dashboardStatus = "succeeded";
        state.dashboard = action.payload;
        state.dashboardLoadedAt = Date.now();
      })
      .addCase(fetchDashboard.rejected, (state, action) => {
        state.dashboardStatus = "failed";
        state.dashboardError = action.error.message ?? "Failed to load dashboard";
      })
      .addCase(fetchPatients.pending, (state) => {
        state.patientsStatus = "loading";
        state.patientsError = null;
      })
      .addCase(fetchPatients.fulfilled, (state, action: PayloadAction<PatientListItem[]>) => {
        state.patientsStatus = "succeeded";
        state.patients = action.payload;
        state.patientsLoadedAt = Date.now();
        // Record which clinic this cache belongs to (derived from the first patient's clinic_id)
        if (action.payload.length > 0 && action.payload[0].clinic_id) {
          state.activeClinicId = action.payload[0].clinic_id;
        }
      })
      .addCase(fetchPatients.rejected, (state, action) => {
        state.patientsStatus = "failed";
        state.patientsError = action.error.message ?? "Failed to load patients";
      })
      .addCase(fetchPendingPatients.pending, (state) => {
        state.pendingStatus = "loading";
        state.pendingError = null;
      })
      .addCase(fetchPendingPatients.fulfilled, (state, action: PayloadAction<PatientListItem[]>) => {
        state.pendingStatus = "succeeded";
        state.pendingPatients = action.payload;
        state.pendingLoadedAt = Date.now();
      })
      .addCase(fetchPendingPatients.rejected, (state, action) => {
        state.pendingStatus = "failed";
        state.pendingError = action.error.message ?? "Failed to load pending patients";
      })
      .addCase(fetchPatient.pending, (state) => {
        state.patientDetailStatus = "loading";
        state.patientDetailError = null;
      })
      .addCase(fetchPatient.fulfilled, (state, action: PayloadAction<PatientDetail>) => {
        state.patientDetailStatus = "succeeded";
        state.patientDetail = action.payload;
      })
      .addCase(fetchPatient.rejected, (state, action) => {
        state.patientDetailStatus = "failed";
        state.patientDetailError = action.error.message ?? "Failed to load patient";
      })
      // Flush all cached staff data when a new user logs in or the current user logs out.
      // This prevents a receptionist from one clinic seeing another clinic's patient data
      // if they share a browser session within the cache TTL window.
      .addCase(login.fulfilled, () => initialState)
      .addCase(logout, () => initialState);
  },
});

export const { invalidateDashboard, invalidatePatients, invalidatePendingPatients } = staffSlice.actions;
export default staffSlice.reducer;

// Selectors
export const selectDashboard      = (s: RootState) => s.staff.dashboard;
export const selectDashboardStatus = (s: RootState) => s.staff.dashboardStatus;
export const selectPatients        = (s: RootState) => s.staff.patients;
export const selectPatientsStatus  = (s: RootState) => s.staff.patientsStatus;
export const selectPendingPatients = (s: RootState) => s.staff.pendingPatients;
export const selectPendingStatus   = (s: RootState) => s.staff.pendingStatus;
export const selectPatientDetail   = (s: RootState) => s.staff.patientDetail;
