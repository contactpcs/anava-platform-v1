"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, ChevronLeft, ChevronRight, CalendarDays, Phone, MessageSquare, Eye,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { BookingModal } from "@/components/appointments/BookingModal";
import type { Appointment, AvailabilitySlot } from "@/types/domain.types";

// ─── types ────────────────────────────────────────────────────────

type CalView = "Week" | "Day" | "Month";

// ─── helpers ──────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

function getMonthGrid(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  let cur = getMondayOf(firstDay);
  const weeks: Date[][] = [];
  while (cur <= lastDay || weeks.length < 4) {
    const week = Array.from({ length: 7 }, (_, i) => addDays(cur, i));
    weeks.push(week);
    cur = addDays(cur, 7);
    if (cur > lastDay && weeks.length >= 4) break;
  }
  return weeks;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ─── constants ────────────────────────────────────────────────────

const DAY_LABELS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CAL_START   = 8;
const CAL_END     = 15;
const HOUR_PX     = 64;
const BRAND       = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

const APPT_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  confirmed:   { bg: "#f0fdf4", border: "#4ade80", text: "#15803d" },
  scheduled:   { bg: "#fffbeb", border: "#fbbf24", text: "#92400e" },
  checked_in:  { bg: "#eff6ff", border: "#60a5fa", text: "#1e40af" },
  in_progress: { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" },
  cancelled:   { bg: "#fff1f2", border: "#f87171", text: "#991b1b" },
  no_show:     { bg: "#f9fafb", border: "#9ca3af", text: "#4b5563" },
  completed:   { bg: "#f8fafc", border: "#cbd5e1", text: "#475569" },
  rescheduled: { bg: "#f5f3ff", border: "#a78bfa", text: "#4c1d95" },
};

const STATUS_DOT: Record<string, string> = {
  confirmed:  "#22c55e",
  scheduled:  "#f59e0b",
  checked_in: "#3b82f6",
  cancelled:  "#ef4444",
  completed:  "#94a3b8",
};

// ─── component ────────────────────────────────────────────────────

export default function DoctorDashboard() {
  const router   = useRouter();
  const { user } = useAuth();
  const doctorId = (user as any)?.id ?? "";
  const today    = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [view,       setView]       = useState<CalView>("Week");
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [dayDate,    setDayDate]    = useState<Date>(() => new Date());
  const [monthDate,  setMonthDate]  = useState<Date>(() => new Date());

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [slots,        setSlots]        = useState<AvailabilitySlot[]>([]);
  const [bookingSlot,  setBookingSlot]  = useState<AvailabilitySlot | null>(null);
  const [ghost, setGhost] = useState<{ colIdx: number; top: number; height: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ── fetch range per view ──────────────────────────────────────────

  const fetchRange = useMemo(() => {
    if (view === "Week") {
      return { from: weekMonday, to: addDays(weekMonday, 6) };
    }
    if (view === "Day") {
      return { from: dayDate, to: dayDate };
    }
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    return { from: new Date(year, month, 1), to: new Date(year, month + 1, 0) };
  }, [view, weekMonday, dayDate, monthDate]);

  const fetchAppointments = useCallback(async (from: Date, to: Date) => {
    try {
      const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, {
        params: { date_from: toDateStr(from), date_to: toDateStr(to), limit: 100 },
      });
      setAppointments(data.data ?? []);
    } catch { setAppointments([]); }
  }, []);

  const fetchSlots = useCallback(async (from: Date, to: Date) => {
    if (!doctorId) return;
    try {
      const { data } = await apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), {
        params: { from_date: toDateStr(from), to_date: toDateStr(to), include_unavailable: true },
      });
      setSlots(data.data ?? []);
    } catch { setSlots([]); }
  }, [doctorId]);

  useEffect(() => {
    fetchAppointments(fetchRange.from, fetchRange.to);
    fetchSlots(fetchRange.from, fetchRange.to);
  }, [fetchRange, fetchAppointments, fetchSlots]);

  // ── navigation ────────────────────────────────────────────────────

  const goPrev = () => {
    if (view === "Week")  setWeekMonday((m) => addDays(m, -7));
    if (view === "Day")   setDayDate((d) => addDays(d, -1));
    if (view === "Month") setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const goNext = () => {
    if (view === "Week")  setWeekMonday((m) => addDays(m, 7));
    if (view === "Day")   setDayDate((d) => addDays(d, 1));
    if (view === "Month") setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const goToday = () => {
    const n = new Date();
    if (view === "Week")  setWeekMonday(getMondayOf(n));
    if (view === "Day")   setDayDate(n);
    if (view === "Month") setMonthDate(n);
  };

  // ── derived ───────────────────────────────────────────────────────

  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);

  const calLabel = useMemo(() => {
    if (view === "Week") {
      const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${s} – ${e}`;
    }
    if (view === "Day") {
      return dayDate.toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      });
    }
    return monthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [view, weekDates, dayDate, monthDate]);

  const apptByDay = useMemo(() => {
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

  const upcoming = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return [...appointments]
      .filter((a) => {
        if (a.appointment_date < todayStr) return false;
        if (a.status === "cancelled" || a.status === "completed") return false;
        if (q) return (a.patient_name || "").toLowerCase().includes(q) || (a.reason || "").toLowerCase().includes(q);
        return true;
      })
      .sort((a, b) => {
        const dc = a.appointment_date.localeCompare(b.appointment_date);
        return dc !== 0 ? dc : a.start_time.localeCompare(b.start_time);
      })
      .slice(0, 1);
  }, [appointments, todayStr, searchQuery]);

  // ── booking helpers ───────────────────────────────────────────────

  const nearestAvailableSlot = useCallback(
    (dateStr: string, rawMins: number): AvailabilitySlot | null => {
      const daySlots = (slotsByDate[dateStr] ?? []).filter((s) => s.is_available);
      if (!daySlots.length) return null;
      const best = daySlots.reduce((a, b) =>
        Math.abs(timeToMins(a.start_time) - rawMins) <= Math.abs(timeToMins(b.start_time) - rawMins) ? a : b
      );
      return Math.abs(timeToMins(best.start_time) - rawMins) <= 45 ? best : null;
    },
    [slotsByDate],
  );

  const handleColumnMouseMove = useCallback(
    (colIdx: number, dateStr: string, e: React.MouseEvent<HTMLDivElement>) => {
      const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
      const rawMins = Math.floor((y / HOUR_PX) * 60) + CAL_START * 60;
      const slot = nearestAvailableSlot(dateStr, rawMins);
      if (slot) {
        setGhost({ colIdx, top: timeToMins(slot.start_time) - CAL_START * 60, height: timeToMins(slot.end_time) - timeToMins(slot.start_time) });
      } else {
        setGhost(null);
      }
    },
    [nearestAvailableSlot],
  );

  const handleColumnClick = useCallback(
    (colIdx: number, dateStr: string, e: React.MouseEvent<HTMLDivElement>) => {
      const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
      const rawMins = Math.floor((y / HOUR_PX) * 60) + CAL_START * 60;
      const slot = nearestAvailableSlot(dateStr, rawMins);
      if (slot) setBookingSlot(slot);
    },
    [nearestAvailableSlot],
  );

  const hours     = Array.from({ length: CAL_END - CAL_START }, (_, i) => CAL_START + i);
  const gridHeight = (CAL_END - CAL_START) * HOUR_PX;

  const doctorName  = user?.first_name || "Doctor";
  const todayDisplay = today.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  // ── time-grid column renderer (shared by Week + Day) ─────────────

  const renderTimeColumn = (dateStr: string, colIdx: number) => {
    const dayAppts = apptByDay[dateStr] || [];
    const hasSlots = (slotsByDate[dateStr] ?? []).some((s) => s.is_available);
    return (
      <div
        key={colIdx}
        className="relative border-l border-neutral-100"
        style={{ height: gridHeight, cursor: hasSlots ? "pointer" : "default" }}
        onMouseMove={(e) => handleColumnMouseMove(colIdx, dateStr, e)}
        onMouseLeave={() => setGhost(null)}
        onClick={(e) => handleColumnClick(colIdx, dateStr, e)}
      >
        {hours.map((h) => (
          <div key={h} className="absolute left-0 right-0 border-t border-neutral-100"
            style={{ top: (h - CAL_START) * HOUR_PX }} />
        ))}

        {/* ghost hover */}
        {ghost?.colIdx === colIdx && (
          <div
            className="absolute left-1 right-1 rounded-md pointer-events-none"
            style={{
              top:    ghost.top,
              height: Math.max(ghost.height, 24),
              backgroundColor: "rgba(34,197,94,0.12)",
              border: "1.5px dashed #4ade80",
            }}
          />
        )}

        {dayAppts.map((appt) => {
          const top    = timeToMins(appt.start_time) - CAL_START * 60;
          const height = Math.max(timeToMins(appt.end_time) - timeToMins(appt.start_time), 24);
          if (top < 0 || top >= gridHeight) return null;
          const sty = APPT_STYLE[appt.status] ?? APPT_STYLE.scheduled;
          return (
            <div
              key={appt.appointment_id}
              className="absolute left-1 right-1 rounded-md overflow-hidden px-1.5 py-1 cursor-pointer hover:brightness-95 transition-all"
              style={{
                top,
                height: Math.min(height, gridHeight - top),
                backgroundColor: sty.bg,
                borderLeft: `3px solid ${sty.border}`,
                color: sty.text,
              }}
              onClick={(e) => { e.stopPropagation(); router.push(`/doctor/appointments/${appt.appointment_id}`); }}
            >
              <div className="text-[10px] font-semibold leading-tight truncate">
                {fmt12(appt.start_time).replace(" AM","").replace(" PM","")}–{fmt12(appt.end_time).replace(" AM","").replace(" PM","")}
              </div>
              {height >= 36 && (
                <div className="text-[10px] truncate mt-0.5 opacity-80">
                  {appt.patient_name || "Patient"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome back, Dr. {doctorName}!</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Here&apos;s what&apos;s happening in your practice today.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patients, appointments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm bg-white border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-transparent w-full sm:w-64 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-700">
            <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: "#00A1E4" }} />
            <span>Today, {todayDisplay}</span>
          </div>
        </div>
      </div>

      {/* next appointments + quick actions */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_280px] mb-6">
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">Next Appointment</h2>
            <Link href="/doctor/appointments" className="text-sm font-medium hover:underline" style={{ color: "#00A1E4" }}>
              View all
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {upcoming.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-neutral-400">No upcoming appointments</p>
            ) : upcoming.map((appt) => (
              <div key={appt.appointment_id} className="px-5 py-4 hover:bg-neutral-50/60 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-base font-bold text-neutral-900 leading-tight truncate">{appt.patient_name || "—"}</p>
                      <Link href={`/doctor/patients/${appt.patient_id}`} className="flex-shrink-0">
                        <Eye className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 transition-colors" />
                      </Link>
                    </div>
                    {(appt.appointment_type || appt.reason) && (
                      <span className="inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700">
                        {(appt.appointment_type || appt.reason || "").replace(/_/g, " ")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xl font-bold text-neutral-900 leading-none">{fmt12(appt.start_time)}</p>
                    <p className="text-xs text-neutral-500 leading-none">
                      {new Date(appt.appointment_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </p>
                    <Link href={`/doctor/appointments/${appt.appointment_id}`}>
                      <button
                        className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}
                      >
                        Start Visit
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-6">
          <h2 className="text-base font-semibold text-neutral-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <Phone className="w-5 h-5 flex-shrink-0" />
              Contact Receptionist
            </button>
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-white font-medium text-sm transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              <MessageSquare className="w-5 h-5 flex-shrink-0" />
              Contact Clinical Assistant
            </button>
          </div>
        </div>
      </div>

      {/* calendar */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-card mb-6 overflow-hidden">
        {/* toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-wrap gap-3">
          <h2 className="text-base font-semibold text-neutral-900">Appointment Calendar</h2>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button onClick={goToday}
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                Today
              </button>
              <button onClick={goPrev}
                className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goNext}
                className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-neutral-700 min-w-[200px]">{calLabel}</span>
            </div>

            {/* view switcher */}
            <div className="flex items-center rounded-lg border border-neutral-200 overflow-hidden text-sm font-medium">
              {(["Week", "Day", "Month"] as CalView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="px-3 py-1.5 transition-colors"
                  style={view === v
                    ? { background: BRAND, color: "#fff" }
                    : { background: "#fff", color: "#525252" }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Week view ── */}
        {view === "Week" && (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 700 }}>
              {/* day headers */}
              <div className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                <div />
                {weekDates.map((d, i) => {
                  const ds = toDateStr(d);
                  const isToday = ds === todayStr;
                  return (
                    <div key={i} className="text-center py-3 px-1 border-l border-neutral-100">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                        {DAY_LABELS[i]}
                      </div>
                      <div
                        className="inline-flex items-center justify-center w-8 h-8 mx-auto rounded-full text-sm font-bold"
                        style={isToday ? { background: BRAND, color: "#fff" } : { color: "#262626" }}
                      >
                        {d.getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* time grid */}
              <div className="relative" style={{ height: gridHeight }}>
                <div className="grid h-full" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
                  {/* hour labels */}
                  <div className="relative">
                    {hours.map((h) => (
                      <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                        style={{ top: (h - CAL_START) * HOUR_PX, height: HOUR_PX }}>
                        <span className="text-[10px] text-neutral-400 font-medium mt-1">
                          {String(h).padStart(2, "0")}:00
                        </span>
                      </div>
                    ))}
                  </div>
                  {weekDates.map((d, colIdx) => renderTimeColumn(toDateStr(d), colIdx))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Day view ── */}
        {view === "Day" && (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 400 }}>
              {/* single day header */}
              <div className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "52px 1fr" }}>
                <div />
                <div className="text-center py-3 px-1 border-l border-neutral-100">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                    {dayDate.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div
                    className="inline-flex items-center justify-center w-8 h-8 mx-auto rounded-full text-sm font-bold"
                    style={toDateStr(dayDate) === todayStr ? { background: BRAND, color: "#fff" } : { color: "#262626" }}
                  >
                    {dayDate.getDate()}
                  </div>
                </div>
              </div>
              {/* time grid */}
              <div className="relative" style={{ height: gridHeight }}>
                <div className="grid h-full" style={{ gridTemplateColumns: "52px 1fr" }}>
                  <div className="relative">
                    {hours.map((h) => (
                      <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                        style={{ top: (h - CAL_START) * HOUR_PX, height: HOUR_PX }}>
                        <span className="text-[10px] text-neutral-400 font-medium mt-1">
                          {String(h).padStart(2, "0")}:00
                        </span>
                      </div>
                    ))}
                  </div>
                  {renderTimeColumn(toDateStr(dayDate), 0)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Month view ── */}
        {view === "Month" && (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 560 }}>
              {/* day-of-week headers */}
              <div className="grid border-b border-neutral-100" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                {DAY_LABELS.map((l) => (
                  <div key={l} className="text-center py-3 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide border-r border-neutral-100 last:border-r-0">
                    {l}
                  </div>
                ))}
              </div>

              {/* month grid */}
              {getMonthGrid(monthDate.getFullYear(), monthDate.getMonth()).map((week, wi) => (
                <div key={wi} className="grid border-b border-neutral-100 last:border-b-0"
                  style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {week.map((d, di) => {
                    const ds          = toDateStr(d);
                    const isToday     = ds === todayStr;
                    const isCurMonth  = d.getMonth() === monthDate.getMonth();
                    const dayAppts    = apptByDay[ds] || [];
                    const freeSlots   = (slotsByDate[ds] ?? []).filter((s) => s.is_available).length;

                    return (
                      <div
                        key={di}
                        className={`border-r border-neutral-100 last:border-r-0 p-2 min-h-[80px] transition-colors ${
                          isCurMonth ? "cursor-pointer hover:bg-neutral-50" : "bg-neutral-50/50"
                        }`}
                        onClick={() => {
                          if (!isCurMonth) return;
                          setDayDate(d);
                          setView("Day");
                        }}
                      >
                        {/* date number */}
                        <div
                          className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mb-1"
                          style={
                            isToday
                              ? { background: BRAND, color: "#fff" }
                              : { color: isCurMonth ? "#262626" : "#d4d4d4" }
                          }
                        >
                          {d.getDate()}
                        </div>

                        {/* appointment dots */}
                        {dayAppts.length > 0 && (
                          <div className="flex flex-wrap gap-0.5 mb-1">
                            {dayAppts.slice(0, 4).map((a) => (
                              <div
                                key={a.appointment_id}
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: STATUS_DOT[a.status] ?? "#94a3b8" }}
                                title={`${a.patient_name ?? "Patient"} — ${a.start_time}`}
                              />
                            ))}
                            {dayAppts.length > 4 && (
                              <span className="text-[9px] text-neutral-400">+{dayAppts.length - 4}</span>
                            )}
                          </div>
                        )}

                        {/* appointment count */}
                        {dayAppts.length > 0 && (
                          <div className="text-[10px] text-neutral-500 leading-tight">
                            {dayAppts.length} appt{dayAppts.length !== 1 ? "s" : ""}
                          </div>
                        )}

                        {/* free slots badge */}
                        {isCurMonth && freeSlots > 0 && (
                          <div className="text-[9px] text-green-600 leading-tight mt-0.5">
                            {freeSlots} free
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* legend */}
        <div className="flex items-center justify-center gap-6 px-6 py-3 border-t border-neutral-100 flex-wrap">
          {[
            { label: "Confirmed", color: "#22c55e" },
            { label: "Pending",   color: "#f59e0b" },
            { label: "Cancelled", color: "#ef4444" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs text-neutral-500">{label}</span>
            </div>
          ))}
          {view !== "Month" && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded border border-dashed border-green-400 bg-green-50" />
              <span className="text-xs text-neutral-500">Available — click to book</span>
            </div>
          )}
          {view === "Month" && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400">Click a day to view schedule</span>
            </div>
          )}
        </div>
      </div>

      {/* booking modal */}
      {bookingSlot && (
        <BookingModal
          slot={bookingSlot}
          doctorId={doctorId}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => {
            setBookingSlot(null);
            fetchAppointments(fetchRange.from, fetchRange.to);
            fetchSlots(fetchRange.from, fetchRange.to);
          }}
        />
      )}
    </div>
  );
}
