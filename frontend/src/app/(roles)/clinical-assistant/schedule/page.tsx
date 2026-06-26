"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, User, Clock } from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";

interface DoctorSlot {
  slot_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  doctor_id?: string;
}

interface Appointment {
  appointment_id: string;
  patient_id: string;
  patient_name?: string;
  scheduled_date: string;
  scheduled_time: string;
  end_time?: string;
  status: string;
  appointment_type?: string;
  notes?: string;
}

interface DoctorProfile {
  id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  specialisation?: string;
}

const BRAND    = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  scheduled:   { bg: "#eff6ff", text: "#1d4ed8", border: "#93c5fd" },
  confirmed:   { bg: "#f0fdf4", text: "#15803d", border: "#4ade80" },
  checked_in:  { bg: "#fefce8", text: "#a16207", border: "#facc15" },
  in_progress: { bg: "#fdf4ff", text: "#7e22ce", border: "#d8b4fe" },
  completed:   { bg: "#f9fafb", text: "#6b7280", border: "#d1d5db" },
  cancelled:   { bg: "#fff1f2", text: "#be123c", border: "#fda4af" },
  no_show:     { bg: "#fff7ed", text: "#c2410c", border: "#fdba74" },
};

function statusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: "#f9fafb", text: "#6b7280", border: "#d1d5db" };
}

function getMondayOf(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m    = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function CASchedulePage() {
  const router    = useRouter();
  const today     = useMemo(() => new Date(), []);
  const todayStr  = useMemo(() => toDateStr(today), [today]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [doctors,      setDoctors]      = useState<DoctorProfile[]>([]);
  const [selectedDoc,  setSelectedDoc]  = useState<string>("");
  const [slots,        setSlots]        = useState<DoctorSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const weekLabel = useMemo(() => {
    const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  }, [weekDates]);

  useEffect(() => {
    apiClient.get(ENDPOINTS.STAFF.DOCTORS)
      .then((r) => {
        const docs: DoctorProfile[] = r.data?.data ?? [];
        setDoctors(docs);
        if (docs.length > 0) setSelectedDoc(docs[0].id);
      })
      .catch(() => {});
  }, []);

  const fetchWeekData = useCallback(async (doctorId: string, monday: Date) => {
    if (!doctorId) return;
    setLoading(true);
    const from = toDateStr(monday);
    const to   = toDateStr(addDays(monday, 6));
    try {
      const [slotsRes, apptRes] = await Promise.all([
        apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), {
          params: { from_date: from, to_date: to, include_unavailable: true },
        }),
        apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, {
          params: { doctor_id: doctorId, date_from: from, date_to: to, limit: 200 },
        }),
      ]);
      setSlots(slotsRes.data?.data ?? []);
      const apptData = apptRes.data?.data ?? apptRes.data?.items ?? [];
      setAppointments(Array.isArray(apptData) ? apptData : []);
    } catch {
      setSlots([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDoc) fetchWeekData(selectedDoc, weekStart);
  }, [selectedDoc, weekStart, fetchWeekData]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, DoctorSlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [slots]);

  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      const d = a.scheduled_date?.split("T")[0];
      if (!d) continue;
      if (!map[d]) map[d] = [];
      map[d].push(a);
    }
    return map;
  }, [appointments]);

  const selectedDaySlots = (slotsByDate[selectedDate] ?? [])
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const selectedDayAppts = (apptsByDate[selectedDate] ?? [])
    .sort((a, b) => (a.scheduled_time ?? "").localeCompare(b.scheduled_time ?? ""));

  const selectedDoctor = doctors.find((d) => d.id === selectedDoc);
  const doctorName     = selectedDoctor
    ? selectedDoctor.full_name || `${selectedDoctor.first_name ?? ""} ${selectedDoctor.last_name ?? ""}`.trim()
    : "";

  function matchAppt(slot: DoctorSlot): Appointment | undefined {
    return selectedDayAppts.find(
      (a) => a.scheduled_time && slot.start_time && a.scheduled_time.slice(0, 5) === slot.start_time.slice(0, 5)
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clinic Schedule</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Doctors&apos; schedules and appointment details</p>
        </div>
      </div>

      {/* Doctor selector */}
      {doctors.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-4 mb-5">
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Select Doctor</p>
          <div className="flex flex-wrap gap-2">
            {doctors.map((doc) => {
              const name   = doc.full_name || `${doc.first_name ?? ""} ${doc.last_name ?? ""}`.trim() || "Doctor";
              const active = selectedDoc === doc.id;
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
                  style={active
                    ? { background: BRAND, color: "#fff", borderColor: "transparent" }
                    : { background: "#f9fafb", color: "#374151", borderColor: "#e5e7eb" }}
                >
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  {name}
                  {doc.specialisation && <span className="text-[10px] opacity-70 ml-0.5">· {doc.specialisation}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {doctors.length === 0 && !loading && (
        <div className="bg-white rounded-xl border border-neutral-200 p-10 text-center text-sm text-neutral-400 mb-5">
          No doctors found in this clinic
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Week calendar */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 flex-wrap gap-2">
            <span className="text-sm font-semibold text-neutral-900">{weekLabel}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setWeekStart((m) => addDays(m, -7))} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { setWeekStart(getMondayOf(new Date())); setSelectedDate(todayStr); }} className="px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                Today
              </button>
              <button onClick={() => setWeekStart((m) => addDays(m, 7))} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", minWidth: 420 }}>
              {weekDates.map((d, i) => {
                const ds        = toDateStr(d);
                const isToday   = ds === todayStr;
                const isSelec   = ds === selectedDate;
                const daySlots  = slotsByDate[ds] ?? [];
                const dayAppts  = apptsByDate[ds] ?? [];
                const freeSlots = daySlots.filter((s) => s.is_available);
                const busySlots = daySlots.filter((s) => !s.is_available);
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(ds)}
                    className={`border-r border-neutral-100 last:border-r-0 p-3 text-center transition-colors ${isSelec ? "bg-sky-50" : "hover:bg-neutral-50"}`}
                  >
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">{DAY_LABELS[i]}</div>
                    <div
                      className="inline-flex items-center justify-center w-8 h-8 mx-auto rounded-full text-sm font-bold mb-1"
                      style={isToday ? { background: BRAND, color: "#fff" } : isSelec ? { background: "#e0f2fe", color: "#0369a1" } : { color: "#262626" }}
                    >
                      {d.getDate()}
                    </div>
                    {dayAppts.length > 0 && (
                      <div className="text-[10px] text-blue-600 mt-0.5 font-medium">{dayAppts.length} appt{dayAppts.length !== 1 ? "s" : ""}</div>
                    )}
                    {freeSlots.length > 0 && (
                      <div className="text-[10px] text-green-600 mt-0.5 font-medium">{freeSlots.length} free</div>
                    )}
                    {busySlots.length > 0 && dayAppts.length === 0 && (
                      <div className="text-[10px] text-neutral-400 mt-0.5">{busySlots.length} busy</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Day detail panel */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-900">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </h2>
            {doctorName && (
              <p className="text-xs text-neutral-400 mt-0.5">
                {doctorName}
                {selectedDoctor?.specialisation && ` · ${selectedDoctor.specialisation}`}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[520px]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
              </div>
            ) : selectedDaySlots.length === 0 && selectedDayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <Calendar className="w-8 h-8 text-neutral-200 mb-2" />
                <p className="text-sm font-medium text-neutral-400">No slots configured for this day</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {selectedDaySlots.map((slot, i) => {
                  const appt = matchAppt(slot);
                  const ss   = appt ? statusStyle(appt.status) : null;

                  return (
                    <div
                      key={slot.slot_id ?? i}
                      onClick={() => appt && router.push(`/clinical-assistant/appointments/${appt.appointment_id}`)}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors ${appt ? "cursor-pointer hover:bg-neutral-50" : ""}`}
                    >
                      {/* Time column */}
                      <div className="w-20 flex-shrink-0 pt-0.5">
                        <p className="text-sm font-semibold text-neutral-800">{fmt12(slot.start_time)}</p>
                        <p className="text-xs text-neutral-400">{fmt12(slot.end_time)}</p>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {appt ? (
                          <div
                            className="rounded-lg px-3 py-2 border"
                            style={{ background: ss!.bg, borderColor: ss!.border }}
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="text-sm font-semibold" style={{ color: ss!.text }}>
                                {appt.patient_name ?? "Patient"}
                              </p>
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                                style={{ background: ss!.bg, color: ss!.text, border: `1px solid ${ss!.border}` }}
                              >
                                {appt.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            {appt.appointment_type && (
                              <p className="text-xs mt-0.5" style={{ color: ss!.text, opacity: 0.75 }}>
                                {appt.appointment_type}
                              </p>
                            )}
                            <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {fmt12(slot.start_time)} – {fmt12(slot.end_time)}
                              <span className="ml-auto text-[10px] text-blue-500 font-medium">View →</span>
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-neutral-400">Available</span>
                            <span
                              className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                              style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #4ade80" }}
                            >
                              Free
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Appointments with no matching slot (edge case) */}
                {selectedDayAppts
                  .filter((a) => !selectedDaySlots.some((s) => s.start_time.slice(0, 5) === a.scheduled_time?.slice(0, 5)))
                  .map((appt) => {
                    const ss = statusStyle(appt.status);
                    return (
                      <div
                        key={appt.appointment_id}
                        onClick={() => router.push(`/clinical-assistant/appointments/${appt.appointment_id}`)}
                        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-neutral-50 transition-colors"
                      >
                        <div className="w-20 flex-shrink-0 pt-0.5">
                          <p className="text-sm font-semibold text-neutral-800">{fmt12(appt.scheduled_time)}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className="rounded-lg px-3 py-2 border"
                            style={{ background: ss.bg, borderColor: ss.border }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold" style={{ color: ss.text }}>
                                {appt.patient_name ?? "Patient"}
                              </p>
                              <span className="text-[10px] font-semibold capitalize" style={{ color: ss.text }}>
                                {appt.status.replace(/_/g, " ")}
                                <span className="ml-2 text-blue-500">View →</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-neutral-100 flex items-center gap-4 flex-wrap text-xs text-neutral-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Free</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Booked</span>
            </div>
            <span className="ml-auto text-neutral-400 italic">Click appointment to view details</span>
          </div>
        </div>
      </div>
    </div>
  );
}
