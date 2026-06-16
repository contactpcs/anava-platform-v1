"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Clock, Plus, CheckCircle, XCircle, AlertCircle,
  ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { useAppointmentRequests, useSubmitAppointmentRequest } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { Appointment, AppointmentRequest } from "@/types/domain.types";

const STATUS_COLOR: Record<string, string> = {
  scheduled:   "bg-blue-50 text-blue-700",
  confirmed:   "bg-cyan-50 text-cyan-700",
  checked_in:  "bg-purple-50 text-purple-700",
  in_progress: "bg-orange-50 text-orange-700",
  completed:   "bg-green-50 text-green-700",
  cancelled:   "bg-neutral-100 text-neutral-500",
  no_show:     "bg-red-50 text-red-700",
  rescheduled: "bg-yellow-50 text-yellow-700",
};

const REQ_COLOR: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  approved:  "bg-green-50 text-green-700",
  rejected:  "bg-red-50 text-red-600",
  cancelled: "bg-neutral-100 text-neutral-500",
};

const URGENCY_COLOR: Record<string, string> = {
  normal:    "bg-neutral-100 text-neutral-600",
  urgent:    "bg-orange-50 text-orange-700",
  emergency: "bg-red-50 text-red-700",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default function PatientAppointmentsPage() {
  const { user } = useAuth();
  const { requests, isLoading: reqLoading, refresh: refreshReqs } = useAppointmentRequests();
  const { cancel } = useSubmitAppointmentRequest();

  const [appts, setAppts]           = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = useState(true);
  const [tab, setTab]               = useState<"upcoming" | "all">("upcoming");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadAppointments = useCallback(async () => {
    if (!user?.id) return;
    setApptLoading(true);
    try {
      const { appointments } = await appointmentsService.list({ patient_id: user.id, limit: 50 });
      setAppts(appointments);
    } catch {
      // silent
    } finally {
      setApptLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  const now = new Date();
  const upcoming = appts.filter((a) => {
    const d = new Date(`${a.appointment_date}T${a.start_time}`);
    return d >= now && !["cancelled", "no_show"].includes(a.status);
  });
  const displayAppts = tab === "upcoming" ? upcoming : appts;

  const pendingReqs = requests.filter((r) => r.status === "pending");

  const handleCancelRequest = async (id: string) => {
    setCancellingId(id);
    try {
      await cancel(id);
      refreshReqs();
      showToast("Request cancelled.", true);
    } catch {
      showToast("Failed to cancel request.", false);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Appointments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">View upcoming visits and request new appointments</p>
        </div>
        <Link
          href="/patient/appointments/request"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Request Appointment</span>
          <span className="sm:hidden">Request</span>
        </Link>
      </div>

      {/* Pending requests banner */}
      {pendingReqs.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {pendingReqs.length} appointment {pendingReqs.length === 1 ? "request" : "requests"} pending review
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Reception will confirm a date and time shortly.</p>
          </div>
        </div>
      )}

      {/* Appointment Requests */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-800">Appointment Requests</h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <RequestCard
                key={req.request_id}
                req={req}
                onCancel={req.status === "pending" ? handleCancelRequest : undefined}
                cancelling={cancellingId === req.request_id}
              />
            ))}
          </div>
          {reqLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
            </div>
          )}
        </section>
      )}

      {/* Appointments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "upcoming" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
            </button>
            <button
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "all" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              All
            </button>
          </div>
          <button
            onClick={loadAppointments}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {apptLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : displayAppts.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-6 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-medium text-neutral-600">
              {tab === "upcoming" ? "No upcoming appointments" : "No appointments yet"}
            </p>
            <p className="text-sm text-neutral-400 mt-1">
              Use the button above to request an appointment with your doctor.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayAppts.map((a) => (
              <AppointmentCard key={a.appointment_id} appt={a} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AppointmentCard({ appt }: { appt: Appointment }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 flex items-center gap-4">
      <div className="bg-blue-50 rounded-xl p-2.5 flex-shrink-0">
        <CalendarDays className="h-5 w-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-neutral-900">
            {appt.doctor_name ?? "Your Doctor"}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[appt.status] ?? "bg-neutral-100 text-neutral-500"}`}>
            {appt.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {fmtDate(appt.appointment_date)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fmtTime(appt.start_time)}
          </span>
          {appt.appointment_type && (
            <span className="capitalize">{appt.appointment_type.replace(/_/g, " ")}</span>
          )}
        </div>
        {appt.reason && (
          <p className="text-xs text-neutral-400 mt-0.5 truncate">{appt.reason}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
    </div>
  );
}

function RequestCard({
  req,
  onCancel,
  cancelling,
}: {
  req: AppointmentRequest;
  onCancel?: (id: string) => void;
  cancelling?: boolean;
}) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${REQ_COLOR[req.status] ?? "bg-neutral-100 text-neutral-500"}`}>
            {req.status}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${URGENCY_COLOR[req.urgency]}`}>
            {req.urgency}
          </span>
        </div>
        <p className="text-sm text-neutral-700 mt-1.5 line-clamp-2">{req.patient_complaint}</p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
          <span>Preferred: {fmtDate(req.preferred_date_1)}</span>
          <span>Requested {fmtDate(req.created_at)}</span>
        </div>
        {req.status === "rejected" && req.review_notes && (
          <p className="text-xs text-red-600 mt-1.5">Note: {req.review_notes}</p>
        )}
        {req.status === "approved" && (
          <p className="text-xs text-green-700 mt-1.5 font-medium">
            Appointment confirmed — check your upcoming appointments.
          </p>
        )}
      </div>
      {onCancel && (
        <button
          onClick={() => onCancel(req.request_id)}
          disabled={cancelling}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 disabled:opacity-50 flex-shrink-0"
        >
          {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
          Cancel
        </button>
      )}
    </div>
  );
}
