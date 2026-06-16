"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft, Calendar, Clock, User, Stethoscope,
  CheckCircle2, UserCheck, Play, CheckSquare,
  XCircle, RotateCcw, AlertOctagon, Pencil, Save, X,
} from "lucide-react";
import { useAppointmentDetail } from "@/lib/hooks/useAppointments";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { AppointmentStatus, AppointmentType } from "@/types/domain.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; bg: string; text: string; border: string }> = {
  scheduled:   { label: "Scheduled",   bg: "#fffbeb", text: "#92400e", border: "#fbbf24" },
  confirmed:   { label: "Confirmed",   bg: "#f0fdf4", text: "#15803d", border: "#4ade80" },
  checked_in:  { label: "Checked In",  bg: "#eff6ff", text: "#1e40af", border: "#60a5fa" },
  in_progress: { label: "In Progress", bg: "#dbeafe", text: "#1e3a8a", border: "#3b82f6" },
  completed:   { label: "Completed",   bg: "#f8fafc", text: "#475569", border: "#cbd5e1" },
  cancelled:   { label: "Cancelled",   bg: "#fff1f2", text: "#991b1b", border: "#f87171" },
  no_show:     { label: "No Show",     bg: "#fafafa", text: "#52525b", border: "#a1a1aa" },
  rescheduled: { label: "Rescheduled", bg: "#f5f3ff", text: "#4c1d95", border: "#a78bfa" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
      style={{ background: cfg.bg, color: cfg.text, border: `1.5px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Cancel dialog ────────────────────────────────────────────────────────────

function CancelDialog({
  onConfirm, onClose, busy,
}: { onConfirm: (reason: string) => void; onClose: () => void; busy: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="text-base font-semibold text-neutral-900">Cancel Appointment</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-neutral-600">Please provide a reason for cancellation.</p>
          <textarea
            rows={3}
            placeholder="Cancellation reason…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
            Back
          </button>
          <button
            disabled={reason.trim().length < 3 || busy}
            onClick={() => onConfirm(reason.trim())}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {busy ? "Cancelling…" : "Cancel Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reschedule modal ─────────────────────────────────────────────────────────

function RescheduleModal({
  doctorId, onConfirm, onClose, busy,
}: { doctorId: string; onConfirm: (date: string, time: string, reason?: string) => void; onClose: () => void; busy: boolean }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [date,   setDate]   = useState(todayStr);
  const [time,   setTime]   = useState("");
  const [reason, setReason] = useState("");
  const [slots,  setSlots]  = useState<Array<{ start_time: string; end_time: string; is_available: boolean }>>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const fetchSlots = useCallback(async (d: string) => {
    if (!doctorId || !d) return;
    setLoadingSlots(true);
    setSlots([]);
    setTime("");
    try {
      const { data } = await import("@/lib/api/client").then(({ default: c }) =>
        c.get(`/schedule/doctor/${doctorId}/slots`, { params: { from_date: d, to_date: d } }),
      );
      setSlots((data?.data ?? []).filter((s: any) => s.is_available));
    } catch { setSlots([]); }
    finally { setLoadingSlots(false); }
  }, [doctorId]);

  useEffect(() => { fetchSlots(date); }, [date, fetchSlots]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100">
          <h3 className="text-base font-semibold text-neutral-900">Reschedule Appointment</h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-neutral-600 block mb-1">New Date</label>
            <input
              type="date"
              min={todayStr}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-600 block mb-1">Available Slots</label>
            {loadingSlots ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
              </div>
            ) : slots.length === 0 ? (
              <p className="text-xs text-neutral-400 py-2">No available slots on this date</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {slots.map((s) => (
                  <button
                    key={s.start_time}
                    onClick={() => setTime(s.start_time)}
                    className="text-xs px-2 py-1.5 rounded-lg font-medium transition-colors"
                    style={
                      time === s.start_time
                        ? { background: BRAND, color: "#fff" }
                        : { background: "#f0f9ff", color: "#0369a1", border: "1px solid #bae6fd" }
                    }
                  >
                    {fmt12(s.start_time)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-neutral-600 block mb-1">
              Reason <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Doctor unavailable"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
            Back
          </button>
          <button
            disabled={!date || !time || busy}
            onClick={() => onConfirm(date, time, reason || undefined)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: BRAND }}
          >
            {busy ? "Rescheduling…" : "Confirm Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { appointment, confirm, checkIn, start, complete, noShow, cancel, reschedule } = useAppointmentDetail(id);

  const [busy,            setBusy]            = useState(false);
  const [actionError,     setActionError]     = useState("");
  const [showCancel,      setShowCancel]      = useState(false);
  const [showReschedule,  setShowReschedule]  = useState(false);
  const [editingNotes,    setEditingNotes]    = useState(false);
  const [notesVal,        setNotesVal]        = useState("");
  const [history,         setHistory]         = useState<any[]>([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);

  useEffect(() => {
    if (appointment) setNotesVal(appointment.notes ?? "");
  }, [appointment?.appointment_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = useCallback(async () => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const hist = await appointmentsService.getHistory(id);
      setHistory(hist);
    } catch { setHistory([]); }
    finally { setHistoryLoading(false); }
  }, [id]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const run = useCallback(async (fn: () => Promise<any>, label: string) => {
    setBusy(true);
    setActionError("");
    try {
      await fn();
    } catch (e: any) {
      setActionError(e?.response?.data?.detail ?? e?.message ?? `${label} failed`);
    } finally {
      setBusy(false);
    }
  }, []);

  const saveNotes = async () => {
    if (!appointment) return;
    setBusy(true);
    try {
      await appointmentsService.update(id, { notes: notesVal });
      setEditingNotes(false);
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  if (!appointment) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
      </div>
    );
  }

  const status = appointment.status;
  const docId  = appointment.doctor_id;

  // Status-based action availability
  const canConfirm    = status === "scheduled";
  const canCheckIn    = status === "confirmed";
  const canStart      = ["confirmed", "checked_in"].includes(status);
  const canComplete   = status === "in_progress";
  const canNoShow     = ["scheduled", "confirmed"].includes(status);
  const canCancel     = ["scheduled", "confirmed", "checked_in"].includes(status);
  const canReschedule = ["scheduled", "confirmed"].includes(status);

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Back nav */}
      <Link
        href="/doctor/appointments"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-5 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Appointments
      </Link>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        {/* ── Main card ── */}
        <div className="space-y-4">
          {/* Header card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
              <div>
                <h1 className="text-xl font-bold text-neutral-900">
                  {appointment.patient_name ?? "Patient"}
                </h1>
                <p className="text-sm text-neutral-500 mt-0.5 capitalize">
                  {(appointment.appointment_type ?? "consultation").replace("_", " ")}
                </p>
              </div>
              <StatusBadge status={status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 text-sm text-neutral-700">
                <Calendar className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span>{fmtDate(appointment.appointment_date)}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-neutral-700">
                <Clock className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <span>{fmt12(appointment.start_time)} – {fmt12(appointment.end_time)}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-neutral-700">
                <User className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <Link
                  href={`/doctor/patients/${appointment.patient_id}`}
                  className="hover:underline font-medium"
                  style={{ color: "#00A1E4" }}
                >
                  View patient profile
                </Link>
              </div>
              {appointment.booked_by_role && (
                <div className="flex items-center gap-2.5 text-sm text-neutral-500">
                  <Stethoscope className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                  <span className="capitalize">Booked by {appointment.booked_by_role.replace("_", " ")}</span>
                </div>
              )}
            </div>

            {appointment.reason && (
              <div className="mt-4 p-3 bg-neutral-50 rounded-xl">
                <p className="text-xs font-medium text-neutral-500 mb-0.5">Reason</p>
                <p className="text-sm text-neutral-800">{appointment.reason}</p>
              </div>
            )}

            {appointment.patient_complaint && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-xs font-medium text-amber-700 mb-0.5">Patient Complaint</p>
                <p className="text-sm text-amber-900">{appointment.patient_complaint}</p>
              </div>
            )}
          </div>

          {/* Notes card */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-neutral-900">Internal Notes</h2>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 text-xs font-medium hover:underline"
                  style={{ color: "#00A1E4" }}
                >
                  <Pencil className="w-3 h-3" />
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setEditingNotes(false); setNotesVal(appointment.notes ?? ""); }}
                    className="text-xs text-neutral-500 hover:text-neutral-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={busy}
                    className="flex items-center gap-1 text-xs font-medium text-white px-2.5 py-1 rounded-lg disabled:opacity-50"
                    style={{ background: BRAND }}
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                rows={4}
                value={notesVal}
                onChange={(e) => setNotesVal(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 resize-none"
                placeholder="Internal notes about this appointment…"
              />
            ) : appointment.notes ? (
              <p className="text-sm text-neutral-700 whitespace-pre-wrap">{appointment.notes}</p>
            ) : (
              <p className="text-sm text-neutral-400">No notes yet.</p>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl border border-neutral-200 p-5">
              <h2 className="text-sm font-semibold text-neutral-900 mb-3">History</h2>
              <div className="space-y-2.5">
                {history.map((h: any, i: number) => (
                  <div key={h.history_id ?? i} className="flex items-start gap-3 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-neutral-300 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-neutral-700 capitalize">{(h.action ?? "").replace(/_/g, " ")}</span>
                      {h.changed_by_role && (
                        <span className="text-neutral-400 ml-1">by {h.changed_by_role.replace("_", " ")}</span>
                      )}
                      {h.notes && <p className="text-neutral-500 mt-0.5">{h.notes}</p>}
                      <p className="text-neutral-300 mt-0.5">
                        {new Date(h.changed_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Actions sidebar ── */}
        <div className="space-y-4">
          {/* Status actions */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Actions</h2>

            {actionError && (
              <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {actionError}
              </div>
            )}

            <div className="space-y-2">
              {canConfirm && (
                <ActionBtn
                  icon={CheckCircle2}
                  label="Confirm"
                  color="green"
                  busy={busy}
                  onClick={() => run(confirm, "Confirm")}
                />
              )}
              {canCheckIn && (
                <ActionBtn
                  icon={UserCheck}
                  label="Check In Patient"
                  color="blue"
                  busy={busy}
                  onClick={() => run(checkIn, "Check-in")}
                />
              )}
              {canStart && (
                <ActionBtn
                  icon={Play}
                  label="Start Consultation"
                  color="brand"
                  busy={busy}
                  onClick={() => run(start, "Start")}
                />
              )}
              {canComplete && (
                <ActionBtn
                  icon={CheckSquare}
                  label="Mark Complete"
                  color="green"
                  busy={busy}
                  onClick={() => run(complete, "Complete")}
                />
              )}
              {canReschedule && (
                <ActionBtn
                  icon={RotateCcw}
                  label="Reschedule"
                  color="purple"
                  busy={busy}
                  onClick={() => setShowReschedule(true)}
                />
              )}
              {canNoShow && (
                <ActionBtn
                  icon={AlertOctagon}
                  label="Mark No-Show"
                  color="orange"
                  busy={busy}
                  onClick={() => run(noShow, "No-show")}
                />
              )}
              {canCancel && (
                <ActionBtn
                  icon={XCircle}
                  label="Cancel"
                  color="red"
                  busy={busy}
                  onClick={() => setShowCancel(true)}
                />
              )}

              {["completed", "cancelled", "no_show", "rescheduled"].includes(status) && (
                <div
                  className="w-full text-center text-xs py-2 rounded-lg font-medium"
                  style={{ background: cfg.bg, color: cfg.text }}
                >
                  {cfg.label}
                </div>
              )}
            </div>
          </div>

          {/* Appointment meta */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5">
            <h2 className="text-sm font-semibold text-neutral-900 mb-3">Details</h2>
            <dl className="space-y-2 text-xs">
              <MetaRow label="ID" value={appointment.appointment_id.slice(0, 8) + "…"} />
              <MetaRow label="Status" value={STATUS_CONFIG[status].label} />
              <MetaRow
                label="Type"
                value={(appointment.appointment_type ?? "consultation").replace("_", " ")}
                capitalize
              />
              <MetaRow
                label="Booked by"
                value={(appointment.booked_by_role ?? "").replace("_", " ")}
                capitalize
              />
              <MetaRow
                label="Created"
                value={new Date(appointment.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              />
            </dl>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCancel && (
        <CancelDialog
          busy={busy}
          onClose={() => setShowCancel(false)}
          onConfirm={(reason) => {
            setShowCancel(false);
            run(() => cancel(reason), "Cancel");
          }}
        />
      )}
      {showReschedule && (
        <RescheduleModal
          doctorId={docId}
          busy={busy}
          onClose={() => setShowReschedule(false)}
          onConfirm={(date, time, reason) => {
            setShowReschedule(false);
            run(() => reschedule(date, time, reason), "Reschedule");
          }}
        />
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

type BtnColor = "green" | "blue" | "brand" | "purple" | "orange" | "red";

const BTN_STYLES: Record<BtnColor, { bg: string; hover: string; text: string }> = {
  green:  { bg: "#f0fdf4", hover: "#dcfce7", text: "#15803d" },
  blue:   { bg: "#eff6ff", hover: "#dbeafe", text: "#1e40af" },
  brand:  { bg: "#e0f2fe", hover: "#bae6fd", text: "#0369a1" },
  purple: { bg: "#f5f3ff", hover: "#ede9fe", text: "#4c1d95" },
  orange: { bg: "#fff7ed", hover: "#ffedd5", text: "#9a3412" },
  red:    { bg: "#fff1f2", hover: "#ffe4e6", text: "#991b1b" },
};

function ActionBtn({
  icon: Icon, label, color, busy, onClick,
}: { icon: React.ElementType; label: string; color: BtnColor; busy: boolean; onClick: () => void }) {
  const s = BTN_STYLES[color];
  return (
    <button
      disabled={busy}
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
      style={{ backgroundColor: s.bg, color: s.text }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = s.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = s.bg)}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {label}
    </button>
  );
}

function MetaRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={`font-medium text-neutral-800 ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}
