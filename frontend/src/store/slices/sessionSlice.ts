import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { prsService } from "@/lib/api/services";
import type { AssessmentSession, ConditionBattery, Scale } from "@/types/prs.types";

interface SessionState {
  sessions: AssessmentSession[];
  currentSession: AssessmentSession | null;
  conditions: ConditionBattery[];
  currentCondition: ConditionBattery | null;
  scales: Scale[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionState = {
  sessions: [],
  currentSession: null,
  conditions: [],
  currentCondition: null,
  scales: [],
  isLoading: false,
  error: null,
};

export const fetchMySessions = createAsyncThunk("session/fetchMy", async () => {
  const { sessions } = await prsService.getMySessions();
  return sessions;
});

export const fetchSession = createAsyncThunk("session/fetchOne", async (id: string) => {
  return prsService.getSession(id);
});

export const fetchConditions = createAsyncThunk("session/fetchConditions", async () => {
  const { conditions } = await prsService.getConditions();
  return conditions;
});

export const fetchScales = createAsyncThunk("session/fetchScales", async () => {
  const { scales } = await prsService.getScales();
  return scales;
});

export const fetchConditionDetail = createAsyncThunk(
  "session/fetchConditionDetail",
  async (conditionId: string) => {
    return prsService.getCondition(conditionId);
  }
);

export const fetchPatientSessions = createAsyncThunk(
  "session/fetchPatientSessions",
  async (patientId: string) => {
    const { sessions } = await prsService.getPatientSessions(patientId);
    return sessions;
  }
);

export const createSession = createAsyncThunk(
  "session/create",
  async (payload: Parameters<typeof prsService.createSession>[0]) => {
    return prsService.createSession(payload);
  }
);

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    clearCurrentSession: (state) => { state.currentSession = null; },
    clearCurrentCondition: (state) => { state.currentCondition = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMySessions.pending, (state) => { state.isLoading = true; })
      .addCase(fetchMySessions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions = action.payload;
      })
      .addCase(fetchMySessions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || "Failed to load sessions";
      })
      .addCase(fetchSession.fulfilled, (state, action) => {
        state.currentSession = action.payload;
      })
      .addCase(fetchConditions.fulfilled, (state, action) => {
        state.conditions = action.payload;
      })
      .addCase(fetchScales.fulfilled, (state, action) => {
        state.scales = action.payload;
      })
      .addCase(fetchPatientSessions.fulfilled, (state, action) => {
        state.sessions = action.payload;
      })
      .addCase(createSession.fulfilled, (state, action) => {
        state.sessions.unshift(action.payload);
      })
      .addCase(fetchConditionDetail.fulfilled, (state, action) => {
        state.currentCondition = action.payload;
      })
      .addCase(fetchConditionDetail.pending, (state) => {
        state.currentCondition = null;
      });
  },
});

export const { clearCurrentSession, clearCurrentCondition } = sessionSlice.actions;
export default sessionSlice.reducer;
