"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Settings, X, Trash2, CalendarX,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { BookingModal } from "@/components/appointments/BookingModal";
import type {
  WeeklyScheduleRow, ScheduleOverride, AvailabilitySlot,
} from "@/types/domain.types";

// ─── Constants ────────────────────────────────────────────────────────────────

// DB: Sun=0, Mon=1, ..., Sat=6  (schedule_service uses (weekday+1)%7)
const DISPLAY_DAYS = [
  { label: "Monday",    short: "Mon", dow: 1 },
  { label: "Tuesday",   short: "Tue", dow: 2 },
  { label: "Wednesday", short: "Wed", dow: 3 },
  { label: "Thursday",  short: "Thu", dow: 4 },
  { label: "Friday",    short: "Fri", dow: 5 },
  { label: "Saturday",  short: "Sat", dow: 6 },
  { label: "Sunday",    short: "Sun", dow: 0 },
];

const SLOT_DURATIONS = [15, 20, 30, 45, 60];

const BRAND_GRADIENT = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
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

function toHHMM(t: string | null | undefined): string {
  if (!t) return "";
  return t.slice(0, 5);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DoctorSchedulePage() {
  const { user } = useAuth();
  const doctorId = (user as any)?.id ?? "";

  const today    = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => toDateStr(today), [today]);

  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOf(new Date()));
  const weekDates = useMemo(() => getWeekDates(weekMonday), [weekMonday]);

  const [slots,     setSlots]     = useState<AvailabilitySlot[]>([]);
  const [weekly,    setWeekly]    = useState<WeeklyScheduleRow[]>([]);
  const [overrides, setOverrides] = useState<ScheduleOverride[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [bookingSlot,     setBookingSlot]     = useState<AvailabilitySlot | null>(null);
  const [showEditSched,   setShowEditSched]   = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);

  // ── Data fetchers ──────────────────────────────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    if (!doctorId) return;
    try {
      const { data } = await apiClient.get(ENDPOINTS.SCHEDULE.MY);
      const payload = data.data ?? data;
      setWeekly(payload.weekly ?? []);
      setOverrides(payload.overrides ?? []);
    } catch { /* no schedule yet */ }
  }, [doctorId]);

  const fetchSlots = useCallback(async (monday: Date) => {
    if (!doctorId) return;
    setLoadingSlots(true);
    try {
      const dateFrom = toDateStr(monday);
      const end = new Date(monday);
      end.setDate(monday.getDate() + 6);
      const dateTo = toDateStr(end);
      const { data } = await apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), {
        params: { from_date: dateFrom, to_date: dateTo, include_unavailable: true },
      });
      setSlots(data.data ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId]);

  useEffect(() => { fetchSchedule(); }, [fetchSchedule]);
  useEffect(() => { fetchSlots(weekMonday); }, [weekMonday, fetchSlots]);

  const prevWeek = () => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; });

  // ── Derived ───────────────────────────────────────────────────────────────

  const slotsByDate = useMemo(() => {
    const map: Record<string, AvailabilitySlot[]> = {};
    for (const s of slots) {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    }
    return map;
  }, [slots]);

  const weekLabel = (() => {
    const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  })();

  const deleteOverride = async (ov: ScheduleOverride) => {
    try {
      await apiClient.delete(ENDPOINTS.SCHEDULE.DELETE_OVERRIDE(ov.override_id));
      fetchSchedule();
    } catch { /* ignore */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Schedule</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Manage availability and book appointments
          </p>
        </div>
        <button
          onClick={() => setShowEditSched(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: BRAND_GRADIENT }}
        >
          <Settings className="w-4 h-4" />
          Set Weekly Schedule
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[1fr_288px]">
        {/* ── Slot calendar ── */}
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
          {/* toolbar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-neutral-900">Weekly Slots</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWeekMonday(getMondayOf(new Date()))}
                className="px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
              >
                Today
              </button>
              <button onClick={prevWeek} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextWeek} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-neutral-700 min-w-[180px]">{weekLabel}</span>
            </div>
          </div>

          {/* 7-column grid */}
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{ gridTemplateColumns: "repeat(7, 1fr)", minWidth: 560 }}
            >
              {weekDates.map((d, i) => {
                const ds = toDateStr(d);
                const isToday = ds === todayStr;
                const daySlots = slotsByDate[ds] || [];
                const freeCount = daySlots.filter((s) => s.is_available).length;

                return (
                  <div key={i} className="border-r border-neutral-100 last:border-r-0">
                    {/* day header */}
                    <div className="text-center py-3 px-2 border-b border-neutral-100">
                      <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                        {DISPLAY_DAYS[i].short}
                      </div>
                      <div
                        className="inline-flex items-center justify-center w-8 h-8 mx-auto mt-1 rounded-full text-sm font-bold"
                        style={
                          isToday
                            ? { background: BRAND_GRADIENT, color: "#fff" }
                            : { color: "#262626" }
                        }
                      >
                        {d.getDate()}
                      </div>
                      {daySlots.length > 0 && (
                        <div className="text-[10px] text-neutral-400 mt-1">
                          {freeCount}/{daySlots.length} free
                        </div>
                      )}
                    </div>

                    {/* slot pills */}
                    <div className="p-2 space-y-1 min-h-[140px]">
                      {loadingSlots ? (
                        <div className="flex items-center justify-center h-16">
                          <div className="w-4 h-4 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
                        </div>
                      ) : daySlots.length === 0 ? (
                        <div className="flex items-center justify-center h-16">
                          <span className="text-[11px] text-neutral-300">no slots</span>
                        </div>
                      ) : (
                        daySlots.map((slot) => (
                          <button
                            key={slot.start_time}
                            disabled={!slot.is_available}
                            onClick={() => slot.is_available && setBookingSlot(slot)}
                            title={
                              slot.is_available
                                ? `Book ${fmt12(slot.start_time)} – ${fmt12(slot.end_time)}`
                                : "Already booked"
                            }
                            className={`w-full text-[11px] font-medium px-1.5 py-1 rounded-md text-center transition-all ${
                              slot.is_available
                                ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-pointer"
                                : "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-default line-through"
                            }`}
                          >
                            {fmt12(slot.start_time)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* legend */}
          <div className="flex items-center gap-6 px-6 py-3 border-t border-neutral-100">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
              <span className="text-xs text-neutral-500">Available — click to book</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-neutral-100 border border-neutral-200" />
              <span className="text-xs text-neutral-500">Already booked</span>
            </div>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Weekly template summary */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Weekly Template</h3>
              <button
                onClick={() => setShowEditSched(true)}
                className="text-xs font-medium hover:underline"
                style={{ color: "#00A1E4" }}
              >
                Edit
              </button>
            </div>

            {weekly.filter((w) => w.is_active).length === 0 ? (
              <div className="text-center py-6">
                <p className="text-xs text-neutral-400">No schedule set yet</p>
                <button
                  onClick={() => setShowEditSched(true)}
                  className="mt-2 text-xs font-medium hover:underline"
                  style={{ color: "#00A1E4" }}
                >
                  Set up schedule
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {DISPLAY_DAYS.map((dd) => {
                  const row = weekly.find((w) => w.day_of_week === dd.dow && w.is_active);
                  if (!row) return null;
                  return (
                    <div key={dd.dow} className="flex items-center gap-2 text-xs">
                      <span className="w-7 font-semibold text-neutral-700">{dd.short}</span>
                      <span className="text-neutral-500 flex-1">
                        {toHHMM(row.start_time)}–{toHHMM(row.end_time)}
                      </span>
                      <span className="text-neutral-400">{row.slot_duration_minutes}m</span>
                      {(row.break_start && row.break_end) && (
                        <span className="text-neutral-300 text-[10px]">
                          break {toHHMM(row.break_start)}–{toHHMM(row.break_end)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Date overrides */}
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-neutral-900">Date Overrides</h3>
              <button
                onClick={() => setShowAddOverride(true)}
                className="flex items-center gap-1 text-xs font-medium hover:underline"
                style={{ color: "#00A1E4" }}
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>

            {overrides.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-4">No upcoming overrides</p>
            ) : (
              <div className="space-y-2.5">
                {overrides.map((ov) => (
                  <div key={ov.override_id} className="flex items-start gap-2 text-xs group">
                    <CalendarX className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium text-neutral-800">
                          {new Date(ov.override_date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            ov.is_available
                              ? "bg-blue-100 text-blue-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {ov.is_available ? "Custom hrs" : "Day off"}
                        </span>
                      </div>
                      {ov.is_available && ov.start_time && ov.end_time && (
                        <div className="text-neutral-500 mt-0.5">
                          {toHHMM(ov.start_time)}–{toHHMM(ov.end_time)}
                        </div>
                      )}
                      {ov.reason && (
                        <div className="text-neutral-400 truncate mt-0.5">{ov.reason}</div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteOverride(ov)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-red-500 flex-shrink-0"
                      title="Remove override"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {bookingSlot && (
        <BookingModal
          slot={bookingSlot}
          doctorId={doctorId}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => { setBookingSlot(null); fetchSlots(weekMonday); }}
        />
      )}
      {showEditSched && (
        <EditScheduleModal
          existing={weekly}
          onClose={() => setShowEditSched(false)}
          onSuccess={() => { setShowEditSched(false); fetchSchedule(); fetchSlots(weekMonday); }}
        />
      )}
      {showAddOverride && (
        <AddOverrideModal
          onClose={() => setShowAddOverride(false)}
          onSuccess={() => { setShowAddOverride(false); fetchSchedule(); fetchSlots(weekMonday); }}
        />
      )}
    </div>
  );
}

// ─── EditScheduleModal ────────────────────────────────────────────────────────

interface DayCfg {
  enabled: boolean;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start: string;
  break_end: string;
}

function EditScheduleModal({
  existing, onClose, onSuccess,
}: {
  existing: WeeklyScheduleRow[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [cfg, setCfg] = useState<Record<number, DayCfg>>(() => {
    const init: Record<number, DayCfg> = {};
    for (const dd of DISPLAY_DAYS) {
      const row = existing.find((w) => w.day_of_week === dd.dow && w.is_active);
      init[dd.dow] = {
        enabled: !!row,
        start_time:            toHHMM(row?.start_time) || "08:00",
        end_time:              toHHMM(row?.end_time)   || "17:00",
        slot_duration_minutes: row?.slot_duration_minutes ?? 30,
        break_start:           toHHMM(row?.break_start) ?? "",
        break_end:             toHHMM(row?.break_end)   ?? "",
      };
    }
    return init;
  });
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState("");

  const patch = (dow: number, p: Partial<DayCfg>) =>
    setCfg((c) => ({ ...c, [dow]: { ...c[dow], ...p } }));

  const save = async () => {
    setBusy(true);
    setError("");
    const items = DISPLAY_DAYS
      .filter((dd) => cfg[dd.dow]?.enabled)
      .map((dd) => {
        const c = cfg[dd.dow];
        return {
          day_of_week:           dd.dow,
          start_time:            c.start_time + ":00",
          end_time:              c.end_time   + ":00",
          slot_duration_minutes: c.slot_duration_minutes,
          break_start:           c.break_start ? c.break_start + ":00" : null,
          break_end:             c.break_end   ? c.break_end   + ":00" : null,
          is_active:             true,
        };
      });
    try {
      await apiClient.put(ENDPOINTS.SCHEDULE.MY, { items });
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Set Weekly Schedule" onClose={onClose} maxWidth="max-w-2xl">
      <div className="overflow-y-auto max-h-[60vh] px-6 py-5 space-y-3">
        {DISPLAY_DAYS.map((dd) => {
          const c = cfg[dd.dow];
          return (
            <div
              key={dd.dow}
              className={`rounded-xl border p-4 transition-colors ${
                c.enabled ? "border-sky-200 bg-sky-50/30" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              {/* day toggle */}
              <label className="flex items-center gap-3 cursor-pointer mb-3 select-none">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => patch(dd.dow, { enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-sky-500"
                />
                <span className={`text-sm font-semibold ${c.enabled ? "text-neutral-900" : "text-neutral-400"}`}>
                  {dd.label}
                </span>
              </label>

              {c.enabled && (
                <div className="grid grid-cols-2 gap-3 ml-7">
                  <div>
                    <label className="field-label">Start time</label>
                    <input type="time" value={c.start_time}
                      onChange={(e) => patch(dd.dow, { start_time: e.target.value })} className="field" />
                  </div>
                  <div>
                    <label className="field-label">End time</label>
                    <input type="time" value={c.end_time}
                      onChange={(e) => patch(dd.dow, { end_time: e.target.value })} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Slot duration</label>
                    <select value={c.slot_duration_minutes}
                      onChange={(e) => patch(dd.dow, { slot_duration_minutes: Number(e.target.value) })}
                      className="field bg-white">
                      {SLOT_DURATIONS.map((d) => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                  <div />
                  <div>
                    <label className="field-label">Break start <span className="text-neutral-300">(opt)</span></label>
                    <input type="time" value={c.break_start}
                      onChange={(e) => patch(dd.dow, { break_start: e.target.value })} className="field" />
                  </div>
                  <div>
                    <label className="field-label">Break end <span className="text-neutral-300">(opt)</span></label>
                    <input type="time" value={c.break_end}
                      onChange={(e) => patch(dd.dow, { break_end: e.target.value })} className="field" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={save}
        confirmLabel={busy ? "Saving…" : "Save Schedule"}
        disabled={busy}
      />
    </Modal>
  );
}

// ─── AddOverrideModal ─────────────────────────────────────────────────────────

function AddOverrideModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const todayStr = toDateStr(new Date());
  const [date,       setDate]       = useState(todayStr);
  const [isAvail,    setIsAvail]    = useState(false);
  const [startTime,  setStartTime]  = useState("08:00");
  const [endTime,    setEndTime]    = useState("17:00");
  const [reason,     setReason]     = useState("");
  const [busy,       setBusy]       = useState(false);
  const [error,      setError]      = useState("");

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        override_date: date,
        is_available:  isAvail,
        reason:        reason || undefined,
      };
      if (isAvail) {
        body.start_time = startTime + ":00";
        body.end_time   = endTime   + ":00";
      }
      await apiClient.post(ENDPOINTS.SCHEDULE.ADD_OVERRIDE, body);
      onSuccess();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add Date Override" onClose={onClose} maxWidth="max-w-sm">
      <div className="px-6 py-5 space-y-4">
        <div>
          <label className="field-label">Date</label>
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={(e) => setDate(e.target.value)}
            className="field"
          />
        </div>

        {/* Day off vs custom hours toggle */}
        <div>
          <label className="field-label">Type</label>
          <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-sm font-medium">
            <button
              onClick={() => setIsAvail(false)}
              className="flex-1 py-2 transition-colors"
              style={!isAvail
                ? { background: "linear-gradient(135deg, #ef4444, #dc2626)", color: "#fff" }
                : { background: "#fff", color: "#525252" }}
            >
              Day Off
            </button>
            <button
              onClick={() => setIsAvail(true)}
              className="flex-1 py-2 transition-colors border-l border-neutral-200"
              style={isAvail
                ? { background: BRAND_GRADIENT, color: "#fff" }
                : { background: "#fff", color: "#525252" }}
            >
              Custom Hours
            </button>
          </div>
        </div>

        {isAvail && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Start</label>
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label">End</label>
              <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="field" />
            </div>
          </div>
        )}

        <div>
          <label className="field-label">
            Reason <span className="text-neutral-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Conference, vacation…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="field"
          />
        </div>

        {error && <ErrorMsg>{error}</ErrorMsg>}
      </div>
      <ModalFooter
        onCancel={onClose}
        onConfirm={save}
        confirmLabel={busy ? "Saving…" : "Save Override"}
        disabled={busy}
      />
    </Modal>
  );
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function Modal({
  title, subtitle, children, onClose, maxWidth = "max-w-lg",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 ml-4 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onCancel, onConfirm, confirmLabel, disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
      <button
        onClick={onCancel}
        className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={disabled}
        className="px-5 py-2 text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        style={{ background: BRAND_GRADIENT }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}
