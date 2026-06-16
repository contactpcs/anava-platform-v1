/**
 * Alerts slice — doctor risk alerts. TTL is very short (1 min) since alerts
 * are live-ish notifications of concerning patient scores.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { prsService } from "@/lib/api/services";
import type { RiskAlert } from "@/types/prs.types";
import type { RootState } from "../store";

const ALERTS_TTL_MS = 60 * 1000; // 1 min

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface AlertsState {
  alerts: RiskAlert[];
  status: LoadStatus;
  loadedAt: number | null;
  error: string | null;
}

const initialState: AlertsState = {
  alerts: [],
  status: "idle",
  loadedAt: null,
  error: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < ALERTS_TTL_MS;
}

export const fetchMyAlerts = createAsyncThunk<
  RiskAlert[],
  void,
  { state: RootState }
>(
  "alerts/fetchMy",
  async () => {
    const { alerts } = await prsService.getMyAlerts();
    return alerts;
  },
  {
    condition: (_, { getState }) => {
      const { status, loadedAt } = getState().alerts;
      if (status === "loading") return false;
      if (status === "succeeded" && isFresh(loadedAt)) return false;
      return true;
    },
  },
);

const alertsSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyAlerts.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchMyAlerts.fulfilled, (state, action: PayloadAction<RiskAlert[]>) => {
        state.status = "succeeded";
        state.alerts = action.payload;
        state.loadedAt = Date.now();
      })
      .addCase(fetchMyAlerts.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to load alerts";
      });
  },
});

export default alertsSlice.reducer;

export const selectMyAlerts = (s: RootState) => s.alerts.alerts;
export const selectAlertsStatus = (s: RootState) => s.alerts.status;
