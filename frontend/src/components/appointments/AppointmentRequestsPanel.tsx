"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle, XCircle, Clock, AlertCircle, Loader2,
  CalendarDays, ChevronDown, ChevronUp,
} from "lucide-react";
import { usePendingRequests, useAppointmentRequests } from "@/lib/hooks";
import type { AppointmentRequest, AppointmentType } from "@/types/domain.types";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

interface SlotInfo {
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const URGENCY_COLOR: Record<string, string> = {
  normal:    "bg-neutral-100 text-neutral-600",
  urgent:    "bg-orange-50 text-orange-700",
  emergency: "bg-red-100 text-red-700 font-semibold",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  approved:  "bg-green-50 text-green-700",
  rejected:  "bg-red-50 text-red-600",
  cancelled: "bg-neutral-100 text-neutral-500",
};

const APPT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "consultation", label: "Consultation" },
  { value: "follow_up",    label: "Follow-up" },
  { value: "assessment",   label: "Assessment" },
  { value: "video",        label: "Video" },
  { value: "emergency",    label: "Emergency" },
];

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

interface ApproveModalState {
  id: string;
  doctorId: string;
  patientName: string;
  preferredDates: string[];
}

interface RejectModalState {
  id: string;
  patientName: string;
}

export function AppointmentRequestsPanel() {
  const {
    pending, pendingCount, isLoading: pendingLoading, refresh: refreshPending,
    approve, reject,
  } = usePendingRequests();

  const { requests: allRequests, isLoading: allLoading } = useAppointmentRequests();

  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [approveModal, setApproveModal] = useState<ApproveModalState | null>(null);
  const [rejectModal,  setRejectModal]  = useState<RejectModalState | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const [approveForm, setApproveForm] = useState({
    appointment_date: "",
    start_time: "",
    appointment_type: "consultation" as AppointmentType,
    notes: "",
  });
  const [rejectNotes, setRejectNotes] = useState("");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const date = approveForm.appointment_date;
    const doctorId = approveModal?.doctorId;
    if (!date || !doctorId) { setSlots([]); return; }
    setSlotsLoading(true);
    setSlots([]);
    setApproveForm((p) => ({ ...p, start_time: "" }));
    apiClient
      .get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), { params: { from_date: date } })
      .then((res) => {
        const d = res.data as Record<string, unknown>;
        const raw = (d?.data ?? []) as SlotInfo[];
        setSlots(Array.isArray(raw) ? raw.filter((s) => s.is_available) : []);
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveForm.appointment_date, approveModal?.doctorId]);

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionId(approveModal.id);
    setApproveError(null);
    try {
      await approve(approveModal.id, {
        appointment_date: approveForm.appointment_date,
        start_time: approveForm.start_time,
        appointment_type: approveForm.appointment_type,
        notes: approveForm.notes || undefined,
      });
      setApproveModal(null);
      setApproveForm({ appointment_date: "", start_time: "", appointment_type: "consultation", notes: "" });
      setSlots([]);
      refreshPending();
      showToast("Appointment confirmed and patient notified.", true);
    } catch (err: unknown) {
      const axErr = err as { response?: { status?: number; data?: { detail?: string } } };
      const status = axErr?.response?.status;
      const detail = axErr?.response?.data?.detail ?? "";
      if (status === 409) {
        const isSlotConflict = detail.toLowerCase().includes("slot") || detail.toLowerCase().includes("booked");
        if (isSlotConflict) {
          setApproveError("This slot is already booked. Please choose a different time.");
          setApproveForm((p) => ({ ...p, start_time: "" }));
          setSlots([]);
        } else {
          setApproveModal(null);
          setSlots([]);
          refreshPending();
          showToast("This request was already reviewed. List refreshed.", false);
        }
      } else {
        showToast("Failed to approve request. Please try again.", false);
      }
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionId(rejectModal.id);
    try {
      await reject(rejectModal.id, rejectNotes);
      setRejectModal(null);
      setRejectNotes("");
      refreshPending();
      showToast("Request rejected and patient notified.", true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setRejectModal(null);
        refreshPending();
        showToast("This request was already reviewed. List refreshed.", false);
      } else {
        showToast("Failed to reject request. Please try again.", false);
      }
    } finally {
      setActionId(null);
    }
  };

  const openApprove = (req: AppointmentRequest) => {
    const dates = [req.preferred_date_1, req.preferred_date_2, req.preferred_date_3].filter(Boolean) as string[];
    setApproveError(null);
    setSlots([]);
    setApproveForm({
      appointment_date: dates[0] ?? "",
      start_time: "",
      appointment_type: "consultation",
      notes: "",
    });
    setApproveModal({
      id: req.request_id,
      doctorId: req.doctor_id,
      patientName: req.patient_name ?? "Patient",
      preferredDates: dates,
    });
  };

  const displayList = tab === "pending" ? pending : allRequests;
  const isLoading = tab === "pending" ? pendingLoading : allLoading;

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">Appointment Requests</h1>
          {pendingCount > 0 && (
            <span className="flex items-center justify-center h-6 min-w-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        <p className="text-sm text-neutral-500 mt-0.5">
          Review patient requests and schedule confirmed appointments
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "pending" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          Pending {pendingCount > 0 && `(${pendingCount})`}
        </button>
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            tab === "all" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
        >
          All Requests
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        </div>
      ) : displayList.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-xl px-6 py-14 text-center">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="font-medium text-neutral-700">All caught up!</p>
          <p className="text-neutral-400 text-sm mt-1">
            {tab === "pending" ? "No pending appointment requests." : "No appointment requests yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((req) => (
            <RequestRow
              key={req.request_id}
              req={req}
              onApprove={req.status === "pending" ? () => openApprove(req) : undefined}
              onReject={req.status === "pending" ? () => setRejectModal({ id: req.request_id, patientName: req.patient_name ?? "Patient" }) : undefined}
              actioning={actionId === req.request_id}
            />
          ))}
        </div>
      )}

      {/* Approve Modal */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Confirm Appointment</h3>
            <p className="text-sm text-neutral-500">
              Scheduling for <span className="font-medium text-neutral-800">{approveModal.patientName}</span>
            </p>

            {approveModal.preferredDates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {approveModal.preferredDates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setApproveForm((p) => ({ ...p, appointment_date: d }))}
                    className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                      approveForm.appointment_date === d
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {fmtDate(d)}
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={approveForm.appointment_date}
                onChange={(e) => setApproveForm((p) => ({ ...p, appointment_date: e.target.value }))}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            {approveForm.appointment_date && (
              <div>
                <label className="text-xs font-medium text-neutral-700 block mb-1.5">
                  Available slots <span className="text-red-500">*</span>
                </label>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-neutral-400 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading available slots…
                  </div>
                ) : slots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const label = s.start_time.slice(0, 5);
                      const val = s.start_time.slice(0, 5);
                      return (
                        <button
                          key={s.start_time}
                          type="button"
                          onClick={() => { setApproveForm((p) => ({ ...p, start_time: val })); setApproveError(null); }}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                            approveForm.start_time === val
                              ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                              : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      No schedule configured for this date. Enter time manually.
                    </p>
                    <input
                      type="time"
                      required
                      value={approveForm.start_time}
                      onChange={(e) => { setApproveForm((p) => ({ ...p, start_time: e.target.value })); setApproveError(null); }}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                )}
              </div>
            )}

            {approveError && (
              <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                {approveError}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">Appointment type</label>
              <div className="flex flex-wrap gap-2">
                {APPT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setApproveForm((p) => ({ ...p, appointment_type: t.value }))}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      approveForm.appointment_type === t.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1">
                Notes <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={approveForm.notes}
                onChange={(e) => setApproveForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Add any notes for the patient…"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setApproveModal(null); setSlots([]); setApproveError(null); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                disabled={!approveForm.appointment_date || !approveForm.start_time || !!actionId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Appointment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Reject Request</h3>
            <p className="text-sm text-neutral-500">
              Rejecting request from{" "}
              <span className="font-medium text-neutral-800">{rejectModal.patientName}</span>. The
              patient will be notified.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1.5">
                Reason for rejection <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Provide a reason to help the patient…"
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectNotes(""); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionId}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Reject Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({
  req,
  onApprove,
  onReject,
  actioning,
}: {
  req: AppointmentRequest;
  onApprove?: () => void;
  onReject?: () => void;
  actioning?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
      <div className="px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Left: patient info + complaint */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-neutral-900">
              {req.patient_name ?? "Patient"}
            </p>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[req.status]}`}>
              {req.status}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${URGENCY_COLOR[req.urgency]}`}>
              {req.urgency}
            </span>
          </div>
          <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{req.patient_complaint}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-neutral-400">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {fmtDate(req.preferred_date_1)}
              {req.preferred_date_2 && `, ${fmtDate(req.preferred_date_2)}`}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {req.preferred_time_window === "any" ? "Any time" : req.preferred_time_window}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {req.status === "pending" && (
            <>
              <button
                onClick={onApprove}
                disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actioning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Approve
              </button>
              <button
                onClick={onReject}
                disabled={actioning}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 bg-white text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </>
          )}
          {req.status === "rejected" && req.review_notes && (
            <span className="text-xs text-neutral-400 max-w-[140px] truncate">{req.review_notes}</span>
          )}
          <button
            onClick={() => setExpanded((p) => !p)}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 py-3 bg-neutral-50 border-t border-neutral-100 space-y-2 text-xs text-neutral-600">
          {req.reason && (
            <div><span className="font-medium">Additional notes:</span> {req.reason}</div>
          )}
          <div className="flex gap-4">
            <span><span className="font-medium">Submitted:</span> {fmtDate(req.created_at)}</span>
            {req.preferred_date_3 && (
              <span><span className="font-medium">3rd choice:</span> {fmtDate(req.preferred_date_3)}</span>
            )}
          </div>
          {req.review_notes && (
            <div className="flex items-start gap-1 text-red-600">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>{req.review_notes}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
