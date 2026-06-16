"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useSubmitAppointmentRequest } from "@/lib/hooks";
import type { TimeWindow, Urgency } from "@/types/domain.types";

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: "any",       label: "Any time" },
  { value: "morning",   label: "Morning (8am – 12pm)" },
  { value: "afternoon", label: "Afternoon (12pm – 5pm)" },
  { value: "evening",   label: "Evening (5pm – 8pm)" },
];

const URGENCIES: { value: Urgency; label: string; desc: string }[] = [
  { value: "normal",    label: "Normal",    desc: "Routine visit, no urgency" },
  { value: "urgent",    label: "Urgent",    desc: "Needs attention within 2–3 days" },
  { value: "emergency", label: "Emergency", desc: "Requires immediate attention" },
];

export default function RequestAppointmentPage() {
  const router = useRouter();
  const { submit } = useSubmitAppointmentRequest();

  const [form, setForm] = useState({
    preferred_date_1:     "",
    preferred_date_2:     "",
    preferred_date_3:     "",
    preferred_time_window: "any" as TimeWindow,
    patient_complaint:    "",
    urgency:              "normal" as Urgency,
    reason:               "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [noDoctorError, setNoDoctorError] = useState(false);

  const set = (k: keyof typeof form, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  const today = new Date().toISOString().split("T")[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.patient_complaint.trim().length < 5) {
      setError("Please describe your complaint (at least 5 characters).");
      return;
    }
    setError(null);
    setNoDoctorError(false);
    setSubmitting(true);

    try {
      await submit({
        preferred_date_1:     form.preferred_date_1,
        preferred_date_2:     form.preferred_date_2 || undefined,
        preferred_date_3:     form.preferred_date_3 || undefined,
        preferred_time_window: form.preferred_time_window,
        patient_complaint:    form.patient_complaint.trim(),
        urgency:              form.urgency,
        reason:               form.reason.trim() || undefined,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
      if (axiosErr?.response?.status === 409) {
        setError("You already have a pending appointment request. Please wait for reception to process it before submitting a new one.");
      } else if (axiosErr?.response?.status === 400) {
        const detail = axiosErr.response.data?.detail ?? "";
        if (detail.toLowerCase().includes("doctor")) {
          setNoDoctorError(true);
        } else {
          setError(detail || "Invalid request. Please check your details.");
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="bg-white border border-neutral-200 rounded-2xl px-8 py-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle className="h-7 w-7 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-neutral-900">Request Submitted</h2>
          <p className="text-sm text-neutral-500">
            Your appointment request has been sent to reception. They will confirm a date and time
            and you will be notified once approved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/patient/appointments"
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              View My Appointments
            </Link>
            <Link
              href="/patient/dashboard"
              className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/patient/appointments"
          className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Request an Appointment</h1>
          <p className="text-sm text-neutral-500">Reception will confirm a slot based on availability.</p>
        </div>
      </div>

      {noDoctorError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No doctor assigned yet</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Please contact the reception desk to get a doctor assigned to your account before requesting an appointment.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
        {/* Preferred dates */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-neutral-800">Preferred Date(s)</label>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-neutral-500 block mb-1">First choice <span className="text-red-500">*</span></label>
              <input
                type="date"
                min={today}
                required
                value={form.preferred_date_1}
                onChange={(e) => set("preferred_date_1", e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Second choice <span className="text-neutral-400">(optional)</span></label>
              <input
                type="date"
                min={today}
                value={form.preferred_date_2}
                onChange={(e) => set("preferred_date_2", e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Third choice <span className="text-neutral-400">(optional)</span></label>
              <input
                type="date"
                min={today}
                value={form.preferred_date_3}
                onChange={(e) => set("preferred_date_3", e.target.value)}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
            </div>
          </div>
        </div>

        {/* Time window */}
        <div>
          <label className="text-sm font-semibold text-neutral-800 block mb-2">Preferred Time</label>
          <div className="grid grid-cols-2 gap-2">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                type="button"
                onClick={() => set("preferred_time_window", tw.value)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium text-left transition-colors ${
                  form.preferred_time_window === tw.value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>
        </div>

        {/* Urgency */}
        <div>
          <label className="text-sm font-semibold text-neutral-800 block mb-2">Urgency</label>
          <div className="space-y-2">
            {URGENCIES.map((u) => (
              <label
                key={u.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.urgency === u.value
                    ? "border-blue-500 bg-blue-50"
                    : "border-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="urgency"
                  value={u.value}
                  checked={form.urgency === u.value}
                  onChange={() => set("urgency", u.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className={`text-sm font-medium ${form.urgency === u.value ? "text-blue-700" : "text-neutral-800"}`}>
                    {u.label}
                  </p>
                  <p className="text-xs text-neutral-500">{u.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Complaint */}
        <div>
          <label className="text-sm font-semibold text-neutral-800 block mb-1.5">
            Describe your complaint <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            minLength={5}
            rows={4}
            value={form.patient_complaint}
            onChange={(e) => set("patient_complaint", e.target.value)}
            placeholder="Describe your symptoms or reason for the visit…"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <p className="text-xs text-neutral-400 mt-1">{form.patient_complaint.length} chars (min 5)</p>
        </div>

        {/* Optional reason */}
        <div>
          <label className="text-sm font-semibold text-neutral-800 block mb-1.5">
            Additional notes <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
            placeholder="Any other details for reception…"
            className="w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <button
          type="submit"
          disabled={submitting || !form.preferred_date_1 || form.patient_complaint.trim().length < 5}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg text-sm font-semibold transition-colors"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Submitting…" : "Submit Request"}
        </button>
      </form>
    </div>
  );
}
