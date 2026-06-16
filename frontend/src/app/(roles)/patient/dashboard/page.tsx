"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell, Search, Calendar, CheckCircle, Clock, ChevronRight,
  User, MessageSquare, PlayCircle, ClipboardList, TrendingUp,
  FileText, Zap, Check, Circle,
} from "lucide-react";
import {
  usePatientDashboard,
  useMyAssessments,
  useMyAnamnesis,
  useMyScoresSummary,
  useMyDoctorNotes,
} from "@/lib/hooks";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { PatientDashboardSkeleton } from "@/components/ui";
import type {
  AssessmentPermission,
  AssessmentInstance,
  Appointment,
} from "@/types/domain.types";

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDayOfMonth(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).getDate().toString();
}

function getMonthAbbr(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatTime(time?: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function PatientDashboardPage() {
  return (
    <Suspense fallback={<PatientDashboardSkeleton />}>
      <PatientDashboard />
    </Suspense>
  );
}

function PatientDashboard() {
  const { dashboard, isLoading: dashLoading } = usePatientDashboard();
  const { assessments, isLoading: assessLoading } = useMyAssessments();
  const { record: anamnesisRecord } = useMyAnamnesis();
  const { summary } = useMyScoresSummary();
  const { notes: doctorNotes } = useMyDoctorNotes();

  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    apiClient
      .get(ENDPOINTS.APPOINTMENTS.UPCOMING)
      .then((res) => {
        const data = res.data;
        setAppointments(Array.isArray(data) ? data : (data?.appointments ?? []));
      })
      .catch(() => {});
  }, []);

  if (dashLoading || assessLoading) return <PatientDashboardSkeleton />;

  const profile = dashboard?.profile;
  const doctor = dashboard?.assigned_doctor;
  const fullName = profile?.full_name ?? "";
  const firstName = fullName ? fullName.split(" ")[0] : "User";

  const pendingAssessments   = assessments.filter((a) => a.status === "granted");
  const completedAssessments = assessments.filter((a) => a.status === "completed");
  const hasAnyAssessments    = assessments.length > 0;
  const scoreInstances = summary?.instances ?? [];

  const upcomingAppts = appointments
    .filter((a) => ["scheduled", "confirmed"].includes(a.status))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

  const nextAppt = upcomingAppts[0];
  const daysToNext = nextAppt ? daysUntil(nextAppt.start_at) : null;

  const completedAppts = appointments.filter((a) => a.status === "completed").length;
  const totalPlannedAppts = appointments.length;

  const profileFields = [
    profile?.full_name, profile?.date_of_birth, profile?.gender, profile?.phone,
    anamnesisRecord?.chief_complaint, anamnesisRecord?.current_medications,
  ];
  const filledFields = profileFields.filter(Boolean).length;
  const profilePct = Math.round((filledFields / profileFields.length) * 100);
  const remainingFields = profileFields.length - filledFields;

  const prsProgress =
    scoreInstances.length > 0 ? Math.round(scoreInstances[0].percentage ?? 0) : 0;

  const treatmentPct = Math.round(
    ((completedAppts + completedAssessments.length * 2) /
      Math.max(totalPlannedAppts + assessments.length * 2, 1)) * 100,
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="pb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-gray-900 truncate">Welcome back, {firstName}!</h1>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">Here's your wellness summary for today.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search appointments, reports..."
              className="pl-8 pr-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            {new Date().toLocaleDateString("en-US", {
              month: "short", day: "numeric",
            })}
          </button>
          <div className="relative">
            <button className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
              <Bell className="w-4 h-4 text-gray-600" />
            </button>
            {doctorNotes.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center">
                {doctorNotes.length}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pb-6 space-y-3">
        {/* Hero Banner */}
        {(nextAppt || pendingAssessments.length > 0) && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}
          >
            <div className="px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-white">
                  {nextAppt ? (
                    <>
                      <h2 className="text-base font-bold leading-tight">
                        Your next session is in {daysToNext} day{daysToNext !== 1 ? "s" : ""}
                      </h2>
                      <p className="text-blue-100 mt-0.5 text-xs">
                        {nextAppt.appointment_type?.replace(/_/g, " ")} · Anava Clinic
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-base font-bold leading-tight">
                        {pendingAssessments[0]?.disease_name} Assessment assigned
                      </h2>
                      <p className="text-blue-100 mt-0.5 text-xs">
                        Complete your pending assessment to track progress
                      </p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {nextAppt && (
                  <div className="bg-white/20 rounded-lg px-3 py-2 text-center text-white">
                    <p className="text-[10px] font-medium text-blue-100 uppercase tracking-wide mb-0.5">
                      Next
                    </p>
                    <p className="text-base font-bold leading-tight">
                      {new Date(nextAppt.start_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric",
                      })}
                    </p>
                    <p className="text-[10px] text-blue-100 mt-0.5">
                      {formatTime(nextAppt.start_time)}
                    </p>
                  </div>
                )}
                {doctor && (
                  <div className="bg-white/10 rounded-lg px-3 py-2 hidden sm:flex items-center gap-2 text-white">
                    <div className="w-7 h-7 rounded-full bg-white/80 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-[10px] text-blue-100">Your Doctor</p>
                      <p className="font-semibold text-xs">{doctor.full_name}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<CheckCircle className="w-4 h-4 text-blue-500" />}
            label="Sessions completed"
            value={completedAppts.toString()}
            sub={totalPlannedAppts > 0 ? `of ${totalPlannedAppts} planned` : "No sessions yet"}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4 text-orange-500" />}
            label="Treatment progress"
            value={`${treatmentPct}%`}
            sub="On track"
            highlight
          />
          <StatCard
            icon={<ClipboardList className="w-4 h-4 text-orange-500" />}
            label="PRS assessment"
            value={
              scoreInstances.length > 0 ? `${prsProgress}%`
                : pendingAssessments.length > 0 ? "Pending" : "—"
            }
            sub={
              pendingAssessments.length > 0 ? "Due soon"
                : scoreInstances[0]?.completed_at
                  ? `Last: ${formatShortDate(scoreInstances[0].completed_at)}`
                  : "No data"
            }
          />
          <StatCard
            icon={<FileText className="w-4 h-4 text-green-500" />}
            label="New reports"
            value={scoreInstances.length.toString()}
            sub={scoreInstances.length > 0 ? "Ready to view" : "No new reports"}
          />
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Profile completion */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <User className="w-4 h-4 text-blue-500" />
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                profilePct >= 100 ? "text-green-700 bg-green-50" : "text-orange-600 bg-orange-50"
              }`}>
                {profilePct >= 100 ? "Complete" : "Incomplete"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Complete your profile</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {profilePct >= 100
                ? "Your profile is complete."
                : "Add insurance details and an emergency contact to unlock full clinic access and smooth check-ins."}
            </p>
            {profilePct < 100 && (
              <>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                    <span>{profilePct}% complete</span>
                    <span>{remainingFields} fields remaining</span>
                  </div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full" style={{ width: `${profilePct}%` }} />
                  </div>
                </div>
                <Link href="/patient/profile" className="mt-auto pt-2.5 flex items-center gap-0.5 text-xs font-medium text-gray-900 hover:text-blue-600">
                  Complete now <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Consent / pending assessment */}
          <div className={`bg-white rounded-xl p-4 border shadow-sm flex flex-col ${
            pendingAssessments.length > 0 ? "border-blue-200" : "border-gray-100"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                pendingAssessments.length > 0
                  ? "text-red-600 bg-red-50"
                  : hasAnyAssessments
                    ? "text-green-700 bg-green-50"
                    : "text-neutral-500 bg-neutral-100"
              }`}>
                {pendingAssessments.length > 0
                  ? "Action needed"
                  : hasAnyAssessments
                    ? "Up to date"
                    : "Not assigned"}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Sign medical consent form</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {pendingAssessments.length > 0
                ? "Required before your next assessment session. Review the treatment consent document and sign digitally."
                : hasAnyAssessments
                  ? "All consent forms are up to date."
                  : "No assessments assigned yet. Your doctor will assign one when ready."}
            </p>
            {pendingAssessments.length > 0 && nextAppt && (
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-orange-600 bg-orange-50 rounded-lg px-2.5 py-1.5">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span>Due before {formatShortDate(nextAppt.start_at)} — your session cannot proceed without this.</span>
              </div>
            )}
            {pendingAssessments.length > 0 && (
              <Link
                href={`/patient/consent/${pendingAssessments[0].permission_id}`}
                className="mt-auto w-full flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-xs font-medium"
                style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}
              >
                Review &amp; sign <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          {/* Book appointment */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] font-medium text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                Quick action
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Request an appointment</h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Book your next session or consultation{doctor ? ` with Dr. ${doctor.last_name}` : ""} using our AI-powered smart scheduler.
            </p>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-500">
              <Zap className="w-3 h-3 text-orange-400" />
              NW Assistant can find the best available slot for you.
            </div>
            <Link href="/patient/appointments/request" className="mt-auto w-full flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}>
              <Zap className="w-3.5 h-3.5" /> Book appointment
            </Link>
          </div>
        </div>

        {/* Middle row: Appointments + Clinician */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Upcoming appointments */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Upcoming appointments</h3>
              <button className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            {upcomingAppts.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400">
                <Calendar className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                <p className="text-xs">No upcoming appointments</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {upcomingAppts.slice(0, 4).map((appt) => (
                  <div key={appt.appointment_id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="text-center w-8 flex-shrink-0">
                      <p className="text-sm font-bold text-gray-900 leading-none">
                        {getDayOfMonth(appt.start_at)}
                      </p>
                      <p className="text-[10px] font-medium text-gray-400">
                        {getMonthAbbr(appt.start_at)}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {appt.reason ?? appt.appointment_type?.replace(/_/g, " ")}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {formatTime(appt.start_time)}
                        {appt.doctor_name ? ` · Dr. ${appt.doctor_name.split(" ").pop()}` : ""}
                        {" · "}{appt.appointment_type === "video" ? "Online" : "In-person"}
                      </p>
                    </div>
                    <AppointmentStatusBadge status={appt.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned clinician */}
          {doctor ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" /> Your assigned Doctor
                </p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{doctor.full_name}</p>
                    <p className="text-xs text-gray-500">{doctor.specialization ?? "Neurologist"}</p>
                    {doctor.phone && <p className="text-[10px] text-gray-400">{doctor.phone}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 mt-3 text-center">
                  <div>
                    <p className="text-base font-bold text-gray-900">{completedAppts}</p>
                    <p className="text-[10px] text-gray-500">Sessions done</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{totalPlannedAppts}</p>
                    <p className="text-[10px] text-gray-500">Total planned</p>
                  </div>
                  <div>
                    <p className="text-base font-bold text-gray-900">{daysToNext ?? "—"}</p>
                    <p className="text-[10px] text-gray-500">Days to next</p>
                  </div>
                </div>
                <button className="mt-3 w-full flex items-center justify-center gap-1.5 text-white py-2 rounded-lg text-xs font-medium" style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}>
                  <MessageSquare className="w-3.5 h-3.5" /> Message Dr. {doctor.last_name}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center p-6 text-center text-gray-400">
              <div>
                <User className="w-8 h-8 mx-auto mb-1.5 opacity-40" />
                <p className="text-xs">No clinician assigned yet</p>
              </div>
            </div>
          )}
        </div>

        {/* Bottom row: PRS Assessment + Treatment Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <PrsAssessmentCard
            pending={pendingAssessments}
            instances={scoreInstances}
            doctor={doctor}
          />

          {/* Treatment Progress */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Treatment progress</h3>
              <button className="text-xs text-blue-600 hover:underline">Details →</button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <ProgressBar
                label="tDCS sessions"
                value={completedAppts}
                max={Math.max(totalPlannedAppts, 10)}
                showCount
                maxDisplay={Math.max(totalPlannedAppts, 10)}
              />
              <ProgressBar
                label="EEG brain mapping"
                value={completedAssessments.filter((a) => a.disease_name?.toLowerCase().includes("eeg")).length}
                max={2}
                showCount
                maxDisplay={2}
              />
              <ProgressBar label="PRS assessment" value={prsProgress} max={100} unit="%" />
              <ProgressBar label="Profile setup" value={profilePct} max={100} unit="%" />
            </div>
            {completedAppts > 0 && (
              <div className="mx-4 mb-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900">Next session payment cleared</p>
                  <p className="text-[10px] text-gray-500">No outstanding balance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

function StatCard({ icon, label, value, sub, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl p-4 border shadow-sm ${
      highlight ? "border-gray-200" : "border-gray-100"
    }`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-xl font-[750] text-gray-700">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function AppointmentStatusBadge({ status }: { status: string }) {
  const base = "text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap";
  if (status === "confirmed") return <span className={`${base} text-green-700 bg-green-50`}>Confirmed</span>;
  if (status === "scheduled") return <span className={`${base} text-yellow-700 bg-yellow-50`}>Pending</span>;
  if (status === "completed") return <span className={`${base} text-gray-600 bg-gray-100`}>Completed</span>;
  if (status === "cancelled") return <span className={`${base} text-red-600 bg-red-50`}>Cancelled</span>;
  return <span className={`${base} text-gray-500 bg-gray-50`}>{status}</span>;
}

function ProgressBar({ label, value, max, showCount, maxDisplay, unit }: {
  label: string;
  value: number;
  max: number;
  showCount?: boolean;
  maxDisplay?: number;
  unit?: string;
}) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-700">{label}</span>
        <span className="text-xs font-medium text-gray-900">
          {showCount ? `${value} / ${maxDisplay ?? max}` : `${value}${unit ?? ""}`}
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── PRS Assessment Card ──────────────────────────────────────────

function PrsAssessmentCard({ pending, instances, doctor }: {
  pending: AssessmentPermission[];
  instances: AssessmentInstance[];
  doctor?: { last_name: string; full_name: string } | null;
}) {
  const activePerm = pending[0] ?? null;

  if (!activePerm && instances.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 flex flex-col items-center justify-center text-center text-gray-400">
        <ClipboardList className="w-8 h-8 mb-1.5 opacity-40" />
        <p className="text-xs font-medium text-gray-500">No PRS assessments assigned</p>
        <p className="text-[10px] mt-0.5">Your doctor will assign assessments here.</p>
      </div>
    );
  }

  // No pending, show last completed
  if (!activePerm) {
    const last = instances[0];
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">PRS Assessment</h3>
          <Link href="/patient/results" className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
            View details <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-900">{last.disease_name ?? last.disease_id}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">Neurological assessment</p>
              </div>
            </div>
            <span className="text-[10px] font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Completed</span>
          </div>
          {last.percentage != null && (
            <div>
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-gray-500">Overall progress</span>
                <span className="font-semibold text-gray-900">{Math.round(last.percentage)}% complete</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(last.percentage)}%` }} />
              </div>
            </div>
          )}
          {last.scale_summaries && last.scale_summaries.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {last.scale_summaries.map((s, i) => (
                <SectionRow
                  key={s.scale_id ?? i}
                  index={i + 1}
                  label={s.scale_name ?? s.scale_code ?? `Scale ${i + 1}`}
                  status="done"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const scales = activePerm.scales ?? [];
  const matchedInstance = instances.find((i) => i.disease_id === activePerm.disease_id);
  const completedScaleIds = new Set(matchedInstance?.scale_summaries?.map((s) => s.scale_id) ?? []);

  let firstCurrentSet = false;
  const sectionStatuses = scales.map((scale) => {
    const isDone = completedScaleIds.has(scale.scale_id);
    let status: "done" | "current" | "pending" = isDone ? "done" : "pending";
    if (!isDone && !firstCurrentSet) { status = "current"; firstCurrentSet = true; }
    return { ...scale, status };
  });

  const totalScales = scales.length;
  const completedScales = sectionStatuses.filter((s) => s.status === "done").length;
  const progressPct = totalScales > 0 ? Math.round((completedScales / totalScales) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">PRS Assessment</h3>
        <Link href="/patient/results" className="text-xs text-blue-600 flex items-center gap-0.5 hover:underline">
          View details <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="px-4 py-3 space-y-3">
        {/* Assessment header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-gray-900">{activePerm.disease_name}</h4>
              <p className="text-[10px] text-gray-500 mt-0.5">Neurological assessment</p>
            </div>
          </div>
          <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">In progress</span>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-gray-500">
          {totalScales > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> ~{(totalScales - completedScales) * 5} min left
            </span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Assigned {formatShortDate(activePerm.granted_at)}
          </span>
          {doctor && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> Dr. {doctor.last_name}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalScales > 0 && (
          <div>
            <div className="flex justify-between text-[10px] mb-1">
              <span className="text-gray-500">Overall progress</span>
              <span className="font-semibold text-gray-900">{progressPct}% complete</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {completedScales} of {totalScales} section{totalScales !== 1 ? "s" : ""} completed · {totalScales - completedScales} remaining
            </p>
          </div>
        )}

        {/* Section list */}
        {sectionStatuses.length > 0 && (
          <div className="space-y-0.5">
            {sectionStatuses.map((section, i) => (
              <SectionRow key={section.scale_id} index={i + 1} label={section.scale_name} status={section.status} />
            ))}
          </div>
        )}

        {sectionStatuses.length === 0 && (
          <p className="text-xs text-gray-500">This assessment will begin once you start the session.</p>
        )}

        {/* CTA */}
        <Link
          href={`/patient/assessment/${activePerm.permission_id}`}
          className="flex items-center justify-center gap-1.5 w-full text-white py-2 rounded-lg text-xs font-medium"
          style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          {completedScales > 0 ? "Continue assessment" : "Start assessment"}
        </Link>
      </div>
    </div>
  );
}

function SectionRow({ index, label, status }: {
  index: number;
  label: string;
  status: "done" | "current" | "pending";
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {status === "done" ? (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : status === "current" ? (
          <Circle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 fill-blue-100" />
        ) : (
          <Circle className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
        )}
        <span className={`text-xs ${
          status === "done" ? "line-through text-gray-400"
            : status === "current" ? "font-medium text-gray-900"
            : "text-gray-400"
        }`}>
          Section {index} — {label}
        </span>
      </div>
      {status === "done" && (
        <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">Done</span>
      )}
      {status === "current" && (
        <span className="text-[10px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">Current</span>
      )}
      {status === "pending" && (
        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">Pending</span>
      )}
    </div>
  );
}
