import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
  appointmentRequestsService,
  type ApproveRequestPayload,
  type CreateRequestPayload,
} from "@/lib/api/services/appointmentRequests.service";
import type { AppointmentRequest } from "@/types/domain.types";
import type { RootState } from "../store";

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface AppointmentRequestsState {
  items: AppointmentRequest[];
  status: LoadStatus;
  pendingCount: number;
}

const initialState: AppointmentRequestsState = {
  items: [],
  status: "idle",
  pendingCount: 0,
};

export const fetchAppointmentRequests = createAsyncThunk(
  "appointmentRequests/fetchList",
  async (params?: { status?: string }) => appointmentRequestsService.list(params),
);

export const createAppointmentRequest = createAsyncThunk(
  "appointmentRequests/create",
  async (payload: CreateRequestPayload) => appointmentRequestsService.create(payload),
);

export const approveAppointmentRequest = createAsyncThunk(
  "appointmentRequests/approve",
  async ({ id, payload }: { id: string; payload: ApproveRequestPayload }) =>
    appointmentRequestsService.approve(id, payload),
);

export const rejectAppointmentRequest = createAsyncThunk(
  "appointmentRequests/reject",
  async ({ id, notes }: { id: string; notes: string }) =>
    appointmentRequestsService.reject(id, notes),
);

export const cancelAppointmentRequest = createAsyncThunk(
  "appointmentRequests/cancel",
  async (id: string) => appointmentRequestsService.cancel(id),
);

function upsertItem(state: AppointmentRequestsState, req: AppointmentRequest) {
  const idx = state.items.findIndex((r) => r.request_id === req.request_id);
  if (idx >= 0) state.items[idx] = req;
  else state.items.push(req);
  state.pendingCount = state.items.filter((r) => r.status === "pending").length;
}

const MUTATION_FULFILLED = [
  approveAppointmentRequest.fulfilled.type,
  rejectAppointmentRequest.fulfilled.type,
  cancelAppointmentRequest.fulfilled.type,
];

const slice = createSlice({
  name: "appointmentRequests",
  initialState,
  reducers: {
    upsertRequest(state, action: PayloadAction<AppointmentRequest>) {
      upsertItem(state, action.payload);
    },
    addRequest(state, action: PayloadAction<AppointmentRequest>) {
      upsertItem(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppointmentRequests.pending,   (s) => { s.status = "loading"; })
      .addCase(fetchAppointmentRequests.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.items = a.payload.requests;
        s.pendingCount = s.items.filter((r) => r.status === "pending").length;
      })
      .addCase(fetchAppointmentRequests.rejected,  (s) => { s.status = "failed"; })
      .addCase(createAppointmentRequest.fulfilled, (s, a) => { upsertItem(s, a.payload); })
      .addMatcher(
        (action) => MUTATION_FULFILLED.includes(action.type),
        (state, action: PayloadAction<AppointmentRequest>) => { upsertItem(state, action.payload); },
      );
  },
});

export default slice.reducer;
export const { upsertRequest, addRequest } = slice.actions;

export const selectRequests        = (s: RootState) => s.appointmentRequests.items;
export const selectPendingRequests = (s: RootState) =>
  s.appointmentRequests.items.filter((r) => r.status === "pending");
export const selectRequestsStatus  = (s: RootState) => s.appointmentRequests.status;
export const selectPendingCount    = (s: RootState) => s.appointmentRequests.pendingCount;
