"use client";

import { useState } from "react";
import { X } from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { doctorsService } from "@/lib/api/services";
import type { AvailabilitySlot, PatientListItem } from "@/types/domain.types";

const BRAND_GRADIENT = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

const APPT_TYPES = [
  { value: "consultation", label: "Consultation" },
  { value: "follow_up",    label: "Follow-up" },
  { value: "assessment",   label: "Assessment" },
  { value: "emergency",    label: "Emergency" },
  { value: "video",        label: "Video" },
];

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export interface BookingModalProps {
  slot: AvailabilitySlot;
  doctorId: string;
  /** Pre-loaded patients list. If not supplied the modal fetches them itself. */
  patients?: PatientListItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingModal({
  slot, doctorId, patients: patientsProp, onClose, onSuccess,
}: BookingModalProps) {
  const [patients,  setPatients]  = useState<PatientListItem[]>(patientsProp ?? []);
  const [fetched,   setFetched]   = useState(!!patientsProp);
  const [search,    setSearch]    = useState("");
  const [patient,   setPatient]   = useState<PatientListItem | null>(null);
  const [apptType,  setApptType]  = useState("consultation");
  const [reason,    setReason]    = useState("");
  const [notes,     setNotes]     = useState("");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState("");

  // Lazy-load patients if not pre-supplied
  const ensurePatients = async () => {
    if (fetched) return;
    try {
      const res = await doctorsService.getPatients({ limit: 100 });
      setPatients(res.patients);
    } catch { /* ignore */ }
    setFetched(true);
  };

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return !q || `${p.first_name} ${p.last_name}`.toLowerCase().includes(q);
  });

  const submit = async () => {
    if (!patient) { setError("Select a patient"); return; }
    setBusy(true);
    setError("");
    try {
      await apiClient.post(ENDPOINTS.APPOINTMENTS.LIST, {
        patient_id:       patient.id,
        doctor_id:        doctorId,
        appointment_date: slot.date,
        start_time:       slot.start_time,
        appointment_type: apptType,
        reason:           reason || undefined,
        notes:            notes  || undefined,
      });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Booking failed");
    } finally {
      setBusy(false);
    }
  };

  const slotDate = new Date(slot.date + "T00:00:00");
  const dateLabel = slotDate.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Book Appointment</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {dateLabel} · {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 ml-4 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-5 space-y-4">
          {/* Patient selector */}
          <div>
            <label className="field-label">Patient</label>
            {patient ? (
              <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-green-800">
                  {patient.first_name} {patient.last_name}
                </span>
                <button onClick={() => setPatient(null)} className="text-green-600 hover:text-green-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={search}
                  onFocus={ensurePatients}
                  onChange={(e) => { setSearch(e.target.value); ensurePatients(); }}
                  className="field"
                />
                {search && (
                  <div className="mt-1 border border-neutral-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto bg-white shadow-dropdown">
                    {filtered.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setPatient(p); setSearch(""); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 border-b border-neutral-100 last:border-0 transition-colors"
                      >
                        <span className="font-medium text-neutral-800">
                          {p.first_name} {p.last_name}
                        </span>
                        {p.mrn && (
                          <span className="text-neutral-400 ml-2 text-xs">({p.mrn})</span>
                        )}
                      </button>
                    ))}
                    {filtered.length === 0 && (
                      <div className="px-3 py-2 text-sm text-neutral-400">No patients found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="field-label">Type</label>
            <select value={apptType} onChange={(e) => setApptType(e.target.value)} className="field bg-white">
              {APPT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Reason */}
          <div>
            <label className="field-label">
              Reason <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Follow-up for headaches"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="field"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="field-label">
              Notes <span className="text-neutral-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Internal notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="field resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !patient}
            className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ background: BRAND_GRADIENT }}
          >
            {busy ? "Booking…" : "Book Appointment"}
          </button>
        </div>
      </div>
    </div>
  );
}
