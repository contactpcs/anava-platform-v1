/**
 * Catalog slice — caches static reference data (scales, conditions, clinics) that the
 * backend treats as semi-immutable. Thunks here use `condition` to skip the fetch
 * when fresh data is already in the store, eliminating redundant network calls.
 */
import { createSlice, createAsyncThunk, createSelector, type PayloadAction } from "@reduxjs/toolkit";
import { prsService, authService } from "@/lib/api/services";
import type { Scale, ConditionBattery } from "@/types/prs.types";
import type { Clinic } from "@/lib/api/services/auth.service";
import type { RootState } from "../store";

// Static reference data is treated as fresh for the lifetime of the tab.
// A finite TTL is still useful so a manual refresh (or a long-lived tab) can
// pick up backend changes without forcing a logout.
const STATIC_TTL_MS = 30 * 60 * 1000; // 30 minutes

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface CatalogState {
  scales: Scale[];
  scalesById: Record<string, Scale>;
  scalesStatus: LoadStatus;
  scalesLoadedAt: number | null;
  scalesError: string | null;

  conditions: ConditionBattery[];
  conditionsStatus: LoadStatus;
  conditionsLoadedAt: number | null;
  conditionsError: string | null;

  clinics: Clinic[];
  clinicsStatus: LoadStatus;
  clinicsLoadedAt: number | null;
  clinicsError: string | null;
}

const initialState: CatalogState = {
  scales: [],
  scalesById: {},
  scalesStatus: "idle",
  scalesLoadedAt: null,
  scalesError: null,

  conditions: [],
  conditionsStatus: "idle",
  conditionsLoadedAt: null,
  conditionsError: null,

  clinics: [],
  clinicsStatus: "idle",
  clinicsLoadedAt: null,
  clinicsError: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < STATIC_TTL_MS;
}

// ─── Thunks ──────────────────────────────────────────────────────────────────
// `condition` returns false to skip the fetch entirely when we have fresh data
// or another fetch is in flight. This is the core of the cache.

export const fetchScales = createAsyncThunk<
  { scales: Scale[]; total: number },
  void,
  { state: RootState }
>(
  "catalog/fetchScales",
  async () => prsService.getScales(),
  {
    condition: (_, { getState }) => {
      const { scalesStatus, scalesLoadedAt } = getState().catalog;
      if (scalesStatus === "loading") return false;
      if (scalesStatus === "succeeded" && isFresh(scalesLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchConditions = createAsyncThunk<
  { conditions: ConditionBattery[]; total: number },
  void,
  { state: RootState }
>(
  "catalog/fetchConditions",
  async () => prsService.getConditions(),
  {
    condition: (_, { getState }) => {
      const { conditionsStatus, conditionsLoadedAt } = getState().catalog;
      if (conditionsStatus === "loading") return false;
      if (conditionsStatus === "succeeded" && isFresh(conditionsLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchClinics = createAsyncThunk<
  Clinic[],
  void,
  { state: RootState }
>(
  "catalog/fetchClinics",
  async () => authService.getClinics(),
  {
    condition: (_, { getState }) => {
      const { clinicsStatus, clinicsLoadedAt } = getState().catalog;
      if (clinicsStatus === "loading") return false;
      if (clinicsStatus === "succeeded" && isFresh(clinicsLoadedAt)) return false;
      return true;
    },
  },
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {
    invalidateScales: (state) => {
      state.scalesLoadedAt = null;
      state.scalesStatus = "idle";
    },
    invalidateConditions: (state) => {
      state.conditionsLoadedAt = null;
      state.conditionsStatus = "idle";
    },
    invalidateClinics: (state) => {
      state.clinicsLoadedAt = null;
      state.clinicsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      // Scales
      .addCase(fetchScales.pending, (state) => {
        state.scalesStatus = "loading";
        state.scalesError = null;
      })
      .addCase(fetchScales.fulfilled, (state, action: PayloadAction<{ scales: Scale[]; total: number }>) => {
        state.scalesStatus = "succeeded";
        state.scales = action.payload.scales;
        state.scalesById = action.payload.scales.reduce<Record<string, Scale>>((acc, s) => {
          acc[s.scale_id] = s;
          return acc;
        }, {});
        state.scalesLoadedAt = Date.now();
      })
      .addCase(fetchScales.rejected, (state, action) => {
        state.scalesStatus = "failed";
        state.scalesError = action.error.message ?? "Failed to load scales";
      })
      // Conditions
      .addCase(fetchConditions.pending, (state) => {
        state.conditionsStatus = "loading";
        state.conditionsError = null;
      })
      .addCase(fetchConditions.fulfilled, (state, action: PayloadAction<{ conditions: ConditionBattery[]; total: number }>) => {
        state.conditionsStatus = "succeeded";
        state.conditions = action.payload.conditions;
        state.conditionsLoadedAt = Date.now();
      })
      .addCase(fetchConditions.rejected, (state, action) => {
        state.conditionsStatus = "failed";
        state.conditionsError = action.error.message ?? "Failed to load conditions";
      })
      // Clinics
      .addCase(fetchClinics.pending, (state) => {
        state.clinicsStatus = "loading";
        state.clinicsError = null;
      })
      .addCase(fetchClinics.fulfilled, (state, action: PayloadAction<Clinic[]>) => {
        state.clinicsStatus = "succeeded";
        state.clinics = action.payload;
        state.clinicsLoadedAt = Date.now();
      })
      .addCase(fetchClinics.rejected, (state, action) => {
        state.clinicsStatus = "failed";
        state.clinicsError = action.error.message ?? "Failed to load clinics";
        state.clinics = [];
      });
  },
});

export const { invalidateScales, invalidateConditions, invalidateClinics } = catalogSlice.actions;
export default catalogSlice.reducer;

// ─── Selectors ───────────────────────────────────────────────────────────────

const selectCatalog = (s: RootState) => s.catalog;

export const selectScales        = createSelector(selectCatalog, (c) => c.scales);
export const selectScalesById    = createSelector(selectCatalog, (c) => c.scalesById);
export const selectScalesStatus  = createSelector(selectCatalog, (c) => c.scalesStatus);
export const selectConditions    = createSelector(selectCatalog, (c) => c.conditions);
export const selectConditionsStatus = createSelector(selectCatalog, (c) => c.conditionsStatus);
export const selectClinics       = createSelector(selectCatalog, (c) => c.clinics);
export const selectClinicsStatus = createSelector(selectCatalog, (c) => c.clinicsStatus);
