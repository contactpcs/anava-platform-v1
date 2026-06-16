"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, CalendarDays, Search,
  CheckCircle2, Clock, UserCheck, Play, XCircle, AlertCircle,
  MoreHorizontal, RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { BookingModal } from "@/components/appointments/BookingModal";
import type { Appointment, AvailabilitySlot, AppointmentStatus } from "@/types/domain.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

const STATUS_FILTERS: { label: string; value: AppointmentStatus | "all" }[] = [
  { label: "All",         value: "all" },
  { label: "Scheduled",   value: "scheduled" },
  { label: "Confirmed",   value: "confirmed" },
  { label: "Checked In",  value: "checked_in" },
  { label: "In Progress", value: "in_progress" },
  { label: "Completed",   value: "completed" },
  { label: "Cancelled",   value: "cancelled" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m    = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.scheduled;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Appointment card (list row) ──────────────────────────────────────────────

function AppointmentRow({ appt }: { appt: Appointment }) {
  const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.scheduled;
  return (
    <Link
      href={`/doctor/appointments/${appt.appointment_id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-0"
    >
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.border }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-neutral-900 truncate">
            {appt.patient_name ?? "Patient"}
          </span>
          <StatusBadge status={appt.status} />
          <span className="text-xs text-neutral-400 capitalize">
            {(appt.appointment_type ?? "consultation").replace("_", " ")}
          </span>
        </div>
        {appt.reason && (
          <p className="text-xs text-neutral-500 truncate mt-0.5">{appt.reason}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-neutral-800">{fmt12(appt.start_time)}</p>
        <p className="text-xs text-neutral-400">{fmt12(appt.end_time)}</p>
      </div>
    </Link>
  );
}

// ─── Today summary bar ────────────────────────────────────────────────────────

function TodaySummary({ appointments }: { appointments: Appointment[] }) {
  const total     = appointments.length;
  const completed = appointments.filter((a) => a.status === "completed").length;
  const pending   = appointments.filter((a) => ["scheduled", "confirmed", "checked_in"].includes(a.status)).length;
  const active    = appointments.filter((a) => a.status === "in_progress").length;

  const stats = [
    { icon: CalendarDays, label: "Total",     value: total,     color: "#00A1E4" },
    { icon: Clock,        label: "Pending",   value: pending,   color: "#f59e0b" },
    { icon: Play,         label: "Active",    value: active,    color: "#3b82f6" },
    { icon: CheckCircle2, label: "Completed", value: completed, color: "#22c55e" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="bg-white rounded-xl border border-neutral-200 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div>
            <p className="text-xl font-bold text-neutral-900">{value}</p>
            <p className="text-xs text-neutral-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DoctorAppointmentsPage() {
  const { user } = useAuth();
  const doctorId = (user as any)?.id ?? "";

  const today      = useMemo(() => new Date(), []);
  const todayStr   = useMemo(() => toDateStr(today), [today]);
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const weekDates  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots,        setSlots]        = useState<AvailabilitySlot[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [search,       setSearch]       = useState("");
  const [bookingSlot,  setBookingSlot]  = useState<AvailabilitySlot | null>(null);

  const weekLabel = useMemo(() => {
    const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  }, [weekDates]);

  const fetchData = useCallback(async (monday: Date) => {
    setLoading(true);
    const from = toDateStr(monday);
    const to   = toDateStr(addDays(monday, 6));
    try {
      const [apptRes, slotsRes] = await Promise.all([
        apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params: { date_from: from, date_to: to, limit: 100 } }),
        doctorId
          ? apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), {
              params: { from_date: from, to_date: to, include_unavailable: true },
            })
          : Promise.resolve({ data: { data: [] } }),
      ]);
      setAppointments(apptRes.data?.data ?? []);
      setSlots(slotsRes.data?.data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => { fetchData(weekStart); }, [weekStart, fetchData]);

  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    for (const a of appointments) {
      if (!map[a.appointment_date]) map[a.appointment_date] = [];
      map[a.appointment_date].push(a);
    }
    return map;
  }, [appointments]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, AvailabilitySlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [slots]);

  const selectedAppts = useMemo(() => {
    const base = apptByDate[selectedDate] ?? [];
    const filtered = statusFilter === "all" ? base : base.filter((a) => a.status === statusFilter);
    if (!search) return filtered;
    const q = search.toLowerCase();
    return filtered.filter((a) => (a.patient_name ?? "").toLowerCase().includes(q) || (a.reason ?? "").toLowerCase().includes(q));
  }, [apptByDate, selectedDate, statusFilter, search]);

  const todayAppts = apptByDate[todayStr] ?? [];

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => { setWeekStart(getMondayOf(new Date())); setSelectedDate(todayStr); }}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Today
        </button>
      </div>

      {/* Today summary */}
      {toDateStr(weekStart) <= todayStr && todayStr <= toDateStr(addDays(weekStart, 6)) && (
        <TodaySummary appointments={todayAppts} />
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        {/* ── Week mini-calendar ── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 flex-wrap gap-2">
            <span className="text-sm font-semibold text-neutral-900">{weekLabel}</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setWeekStart((m) => addDays(m, -7))}
                className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setWeekStart((m) => addDays(m, 7))}
                className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7-col grid */}
          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", minWidth: 420 }}>
              {weekDates.map((d, i) => {
                const ds       = toDateStr(d);
                const isToday  = ds === todayStr;
                const isSelec  = ds === selectedDate;
                const dayAppts = apptByDate[ds] ?? [];
                const freeSlots = (slotsByDate[ds] ?? []).filter((s) => s.is_available);

                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDate(ds)}
                    className={`border-r border-neutral-100 last:border-r-0 p-3 text-center transition-colors ${
                      isSelec ? "bg-sky-50" : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                      {DAY_LABELS[i]}
                    </div>
                    <div
                      className="inline-flex items-center justify-center w-8 h-8 mx-auto rounded-full text-sm font-bold mb-1"
                      style={
                        isToday
                          ? { background: BRAND, color: "#fff" }
                          : isSelec
                          ? { background: "#e0f2fe", color: "#0369a1" }
                          : { color: "#262626" }
                      }
                    >
                      {d.getDate()}
                    </div>
                    {dayAppts.length > 0 && (
                      <div className="flex justify-center gap-0.5 flex-wrap mt-1">
                        {dayAppts.slice(0, 4).map((a) => (
                          <div
                            key={a.appointment_id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: STATUS_CONFIG[a.status]?.border ?? "#94a3b8" }}
                          />
                        ))}
                        {dayAppts.length > 4 && (
                          <span className="text-[9px] text-neutral-400">+{dayAppts.length - 4}</span>
                        )}
                      </div>
                    )}
                    {freeSlots.length > 0 && (
                      <div className="text-[10px] text-green-600 mt-0.5">{freeSlots.length} free</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Available slots for selected date */}
          {(slotsByDate[selectedDate] ?? []).filter((s) => s.is_available).length > 0 && (
            <div className="px-5 py-3 border-t border-neutral-100">
              <p className="text-xs font-medium text-neutral-500 mb-2">Available slots — click to book</p>
              <div className="flex flex-wrap gap-1.5">
                {(slotsByDate[selectedDate] ?? [])
                  .filter((s) => s.is_available)
                  .map((s) => (
                    <button
                      key={s.start_time}
                      onClick={() => setBookingSlot(s)}
                      className="text-xs px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full hover:bg-green-100 transition-colors font-medium"
                    >
                      {fmt12(s.start_time)}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Day list panel ── */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col">
          {/* panel header */}
          <div className="px-4 py-3 border-b border-neutral-100">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-neutral-900">
                {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short", month: "short", day: "numeric",
                })}
                <span className="ml-2 text-xs font-normal text-neutral-400">
                  {(apptByDate[selectedDate] ?? []).length} appointment{(apptByDate[selectedDate] ?? []).length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search patient, reason…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-400 text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
            {/* Status filters */}
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_FILTERS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
                  style={
                    statusFilter === value
                      ? { background: BRAND, color: "#fff" }
                      : { background: "#f5f5f5", color: "#525252" }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* list */}
          <div className="flex-1 overflow-y-auto max-h-[520px]">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
              </div>
            ) : selectedAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <CalendarDays className="w-8 h-8 text-neutral-200 mb-2" />
                <p className="text-sm font-medium text-neutral-400">No appointments</p>
                <p className="text-xs text-neutral-300 mt-1">
                  {statusFilter !== "all" ? "Try changing the filter" : "No appointments on this day"}
                </p>
              </div>
            ) : (
              selectedAppts
                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                .map((appt) => <AppointmentRow key={appt.appointment_id} appt={appt} />)
            )}
          </div>
        </div>
      </div>

      {/* Booking modal */}
      {bookingSlot && doctorId && (
        <BookingModal
          slot={bookingSlot}
          doctorId={doctorId}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => { setBookingSlot(null); fetchData(weekStart); }}
        />
      )}
    </div>
  );
}
