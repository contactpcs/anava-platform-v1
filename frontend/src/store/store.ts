import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import appointmentsReducer from "./slices/appointmentsSlice";
import sessionReducer from "./slices/sessionSlice";
import questionnaireReducer from "./slices/questionnaireSlice";
import catalogReducer from "./slices/catalogSlice";
import staffReducer from "./slices/staffSlice";
import doctorsReducer from "./slices/doctorsSlice";
import permissionsReducer from "./slices/permissionsSlice";
import alertsReducer from "./slices/alertsSlice";
import patientsReducer from "./slices/patientsSlice";
import scoresReducer from "./slices/scoresSlice";
import anamnesisReducer from "./slices/anamnesisSlice";
import notificationsReducer from "./slices/notificationsSlice";
import doctorNotesReducer from "./slices/doctorNotesSlice";
import appointmentRequestsReducer from "./slices/appointmentRequestsSlice";

const combinedReducer = combineReducers({
  auth: authReducer,
  appointments: appointmentsReducer,
  session: sessionReducer,
  questionnaire: questionnaireReducer,
  catalog: catalogReducer,
  staff: staffReducer,
  doctors: doctorsReducer,
  permissions: permissionsReducer,
  alerts: alertsReducer,
  patients: patientsReducer,
  scores: scoresReducer,
  anamnesis: anamnesisReducer,
  notifications: notificationsReducer,
  doctorNotes: doctorNotesReducer,
  appointmentRequests: appointmentRequestsReducer,
});

type AppState = ReturnType<typeof combinedReducer>;

// Reset all slices to their initialState on logout so a new user
// never sees stale cached data (TTL caches, patient dashboard, etc.)
function rootReducer(state: AppState | undefined, action: { type: string }): AppState {
  if (action.type === "auth/logout") {
    return combinedReducer(undefined, action as any);
  }
  return combinedReducer(state, action as any);
}

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
