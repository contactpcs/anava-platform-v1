import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { Appointment, AppointmentStatus } from "@/types/domain.types";
import type { RootState } from "../store";

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface AppointmentsState {
  list: Appointment[];
  today: Appointment[];
  upcoming: Appointment[];
  detail: Record<string, Appointment>;
  listStatus: LoadStatus;
  todayStatus: LoadStatus;
  error: string | null;
  filters: { date_from?: string; date_to?: string; status?: AppointmentStatus };
}

const initialState: AppointmentsState = {
  list: [],
  today: [],
  upcoming: [],
  detail: {},
  listStatus: "idle",
  todayStatus: "idle",
  error: null,
  filters: {},
};

export const fetchAppointments = createAsyncThunk<
  { appointments: Appointment[]; total: number },
  Parameters<typeof appointmentsService.list>[0],
  { state: RootState }
>("appointments/fetchList", async (params) => appointmentsService.list(params));

export const fetchTodayAppointments = createAsyncThunk<Appointment[], void, { state: RootState }>(
  "appointments/fetchToday",
  async () => appointmentsService.getToday(),
  { condition: (_, { getState }) => getState().appointments.todayStatus !== "loading" },
);

export const fetchUpcomingAppointments = createAsyncThunk<Appointment[], void>(
  "appointments/fetchUpcoming",
  async () => appointmentsService.getUpcoming(),
);

export const fetchAppointmentById = createAsyncThunk<Appointment, string>(
  "appointments/fetchById",
  async (id) => appointmentsService.getById(id),
);

export const confirmAppointment = createAsyncThunk<Appointment, string>(
  "appointments/confirm",
  async (id) => appointmentsService.confirm(id),
);

export const checkInAppointment = createAsyncThunk<Appointment, string>(
  "appointments/checkIn",
  async (id) => appointmentsService.checkIn(id),
);

export const startAppointment = createAsyncThunk<Appointment, string>(
  "appointments/start",
  async (id) => appointmentsService.start(id),
);

export const completeAppointment = createAsyncThunk<Appointment, string>(
  "appointments/complete",
  async (id) => appointmentsService.complete(id),
);

export const cancelAppointment = createAsyncThunk<
  Appointment,
  { id: string; cancellation_reason: string }
>("appointments/cancel", async ({ id, cancellation_reason }) =>
  appointmentsService.cancel(id, { cancellation_reason }),
);

export const rescheduleAppointment = createAsyncThunk<
  Appointment,
  { id: string; appointment_date: string; start_time: string; reason?: string }
>("appointments/reschedule", async ({ id, ...payload }) =>
  appointmentsService.reschedule(id, payload),
);

export const markNoShow = createAsyncThunk<Appointment, string>(
  "appointments/noShow",
  async (id) => appointmentsService.markNoShow(id),
);

function upsert(state: AppointmentsState, appt: Appointment) {
  state.detail[appt.appointment_id] = appt;
  const splice = (arr: Appointment[]) => {
    const i = arr.findIndex((a) => a.appointment_id === appt.appointment_id);
    if (i >= 0) arr[i] = appt;
  };
  splice(state.list);
  splice(state.today);
  splice(state.upcoming);
}

const MUTATION_FULFILLED = [
  confirmAppointment.fulfilled.type,
  checkInAppointment.fulfilled.type,
  startAppointment.fulfilled.type,
  completeAppointment.fulfilled.type,
  cancelAppointment.fulfilled.type,
  rescheduleAppointment.fulfilled.type,
  markNoShow.fulfilled.type,
];

const appointmentsSlice = createSlice({
  name: "appointments",
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<AppointmentsState["filters"]>) {
      state.filters = action.payload;
    },
    upsertOne(state, action: PayloadAction<Appointment>) {
      upsert(state, action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppointments.pending,   (s) => { s.listStatus = "loading"; s.error = null; })
      .addCase(fetchAppointments.fulfilled, (s, a) => { s.listStatus = "succeeded"; s.list = a.payload.appointments; })
      .addCase(fetchAppointments.rejected,  (s, a) => { s.listStatus = "failed"; s.error = a.error.message ?? "Failed"; })
      .addCase(fetchTodayAppointments.pending,   (s) => { s.todayStatus = "loading"; })
      .addCase(fetchTodayAppointments.fulfilled, (s, a) => { s.todayStatus = "succeeded"; s.today = a.payload; })
      .addCase(fetchTodayAppointments.rejected,  (s) => { s.todayStatus = "failed"; })
      .addCase(fetchUpcomingAppointments.fulfilled, (s, a) => { s.upcoming = a.payload; })
      .addCase(fetchAppointmentById.fulfilled, (s, a) => { upsert(s, a.payload); })
      .addMatcher(
        (action) => MUTATION_FULFILLED.includes(action.type),
        (state, action: PayloadAction<Appointment>) => { upsert(state, action.payload); },
      );
  },
});

export default appointmentsSlice.reducer;
export const { setFilters, upsertOne } = appointmentsSlice.actions;

export const selectAppointments       = (s: RootState) => s.appointments.list;
export const selectTodayAppointments  = (s: RootState) => s.appointments.today;
export const selectUpcomingAppointments = (s: RootState) => s.appointments.upcoming;
export const selectAppointmentById    = (id: string) => (s: RootState) => s.appointments.detail[id];
export const selectAppointmentsStatus = (s: RootState) => s.appointments.listStatus;
export const selectTodayStatus        = (s: RootState) => s.appointments.todayStatus;
