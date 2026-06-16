/**
 * Permissions slice — manages patient assessment permissions.
 * TTL is short (2 min) since permissions can change in real-time (grants).
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { permissionsService } from "@/lib/api/services";
import type { Permission } from "@/types/domain.types";
import type { RootState } from "../store";

const PERMISSIONS_TTL_MS = 2 * 60 * 1000; // 2 min

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PermissionsState {
  byPatientId: Record<string, { permissions: Permission[]; total: number; loadedAt: number | null }>;
  status: LoadStatus;
  error: string | null;
}

const initialState: PermissionsState = {
  byPatientId: {},
  status: "idle",
  error: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < PERMISSIONS_TTL_MS;
}

export const fetchPatientPermissions = createAsyncThunk<
  { patientId: string; data: { permissions: Permission[]; total: number } },
  string,
  { state: RootState }
>(
  "permissions/fetchPatientPermissions",
  async (patientId: string) => {
    const data = await permissionsService.getPatientPermissions(patientId);
    return { patientId, data };
  },
  {
    condition: (patientId, { getState }) => {
      const cached = getState().permissions.byPatientId[patientId];
      if (!cached) return true;
      if (getState().permissions.status === "loading") return false;
      return !isFresh(cached.loadedAt);
    },
  },
);

const permissionsSlice = createSlice({
  name: "permissions",
  initialState,
  reducers: {
    invalidatePatientPermissions: (state, action: PayloadAction<string>) => {
      const entry = state.byPatientId[action.payload];
      if (entry) entry.loadedAt = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientPermissions.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(
        fetchPatientPermissions.fulfilled,
        (state, action: PayloadAction<{ patientId: string; data: { permissions: Permission[]; total: number } }>) => {
          state.status = "succeeded";
          state.byPatientId[action.payload.patientId] = {
            ...action.payload.data,
            loadedAt: Date.now(),
          };
        }
      )
      .addCase(fetchPatientPermissions.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to load permissions";
      });
  },
});

export const { invalidatePatientPermissions } = permissionsSlice.actions;
export default permissionsSlice.reducer;

const EMPTY_PERMISSIONS: Permission[] = [];
export const selectPatientPermissions = (patientId: string) => (s: RootState) =>
  s.permissions.byPatientId[patientId]?.permissions ?? EMPTY_PERMISSIONS;
