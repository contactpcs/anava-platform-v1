"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronRight, Calendar, Activity, FileText, Shield,
  Filter, ChevronDown, ChevronUp, AlertCircle, Loader2,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { Appointment, AppointmentStatus, Permission, AnamnesisRecord } from "@/types/domain.types";

// ─── types ────────────────────────────────────────────────────────

interface PatientDetailData {
  patient: Record<string, unknown>;
  permissions: Permission[];
  scores_summary: unknown[];
  recent_instances: unknown[];
}

interface DrillResult {
  instance: unknown;
  disease_result: { percentage?: number; severity_level?: string; severity_label?: string } | null;
  scale_results: {
    scale_result_id?: string;
    scale_id: string;
    scale_name?: string;
    scale_code?: string;
    calculated_value?: number;
    max_possible?: number;
    severity_level?: string;
    severity_label?: string;
  }[];
}

type Tab = "appointments" | "prs" | "anamnesis" | "permissions";

// ─── helpers ──────────────────────────────────────────────────────

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityBg(level?: string) {
  switch (level) {
    case "severe":   return "bg-red-50 text-red-700";
    case "moderate": return "bg-orange-50 text-orange-700";
    case "mild":     return "bg-yellow-50 text-yellow-700";
    default:         return "bg-green-50 text-green-700";
  }
}

const APPT_BADGE: Record<string, string> = {
  confirmed:   "bg-green-100 text-green-700",
  scheduled:   "bg-amber-100 text-amber-700",
  checked_in:  "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-200 text-blue-900",
  cancelled:   "bg-red-100 text-red-700",
  no_show:     "bg-gray-100 text-gray-600",
  completed:   "bg-slate-100 text-slate-600",
  rescheduled: "bg-purple-100 text-purple-700",
};

const PERM_BADGE: Record<string, string> = {
  granted:   "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  expired:   "bg-yellow-50 text-yellow-700",
  revoked:   "bg-red-50 text-red-700",
};

// ─── skeleton / error ─────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse p-6">
      {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-neutral-100 rounded-lg" />)}
    </div>
  );
}

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 m-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {msg}
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────

export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("appointments");

  const [patientData, setPatientData]   = useState<PatientDetailData | null>(null);
  const [patientErr, setPatientErr]     = useState<string | null>(null);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading]   = useState(true);
  const [apptErr, setApptErr]           = useState<string | null>(null);

  const [anamnesis, setAnamnesis]         = useState<AnamnesisRecord | null>(null);
  const [anamnesisLoading, setAnamnesisLoading] = useState(true);
  const [anamnesisErr, setAnamnesisErr] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [prsScores, setPrsScores]   = useState<any[]>([]);
  const [prsLoading, setPrsLoading] = useState(true);
  const [prsErr, setPrsErr]         = useState<string | null>(null);

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterStatus,   setFilterStatus]   = useState<AppointmentStatus | "">("");

  const [drillOpen,    setDrillOpen]    = useState<string | null>(null);
  const [drillData,    setDrillData]    = useState<Record<string, DrillResult>>({});
  const [drillLoading, setDrillLoading] = useState<string | null>(null);

  // ── parallel fetch on mount ───────────────────────────────────────

  useEffect(() => {
    Promise.all([
      apiClient.get(ENDPOINTS.DOCTORS.PATIENT(id))
        .then((r) => setPatientData(r.data?.data ?? null))
        .catch(() => setPatientErr("Failed to load patient profile")),

      apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, {
        params: { patient_id: id, limit: 100 },
      })
        .then((r) => setAppointments(r.data?.data ?? []))
        .catch(() => setApptErr("Failed to load appointments"))
        .finally(() => setApptLoading(false)),

      apiClient.get(ENDPOINTS.ANAMNESIS.FOR_PATIENT(id))
        .then((r) => setAnamnesis(r.data?.data ?? null))
        .catch(() => setAnamnesisErr("Failed to load anamnesis"))
        .finally(() => setAnamnesisLoading(false)),

      apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES(id))
        .then((r) => setPrsScores(r.data?.data ?? []))
        .catch(() => setPrsErr("Failed to load PRS scores"))
        .finally(() => setPrsLoading(false)),
    ]);
  }, [id]);

  // ── PRS drill-down (lazy) ─────────────────────────────────────────

  const handleDrill = useCallback(async (instanceId: string) => {
    if (drillOpen === instanceId) { setDrillOpen(null); return; }
    setDrillOpen(instanceId);
    if (drillData[instanceId]) return;
    setDrillLoading(instanceId);
    try {
      const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT_RESULT(id, instanceId));
      setDrillData((prev) => ({ ...prev, [instanceId]: data?.data }));
    } catch { /* silently ignore */ }
    finally { setDrillLoading(null); }
  }, [id, drillOpen, drillData]);

  // ── derived ───────────────────────────────────────────────────────

  const filteredAppts = appointments
    .filter((a) => {
      if (filterDateFrom && a.appointment_date < filterDateFrom) return false;
      if (filterDateTo   && a.appointment_date > filterDateTo)   return false;
      if (filterStatus   && a.status !== filterStatus)            return false;
      return true;
    })
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

  const patient  = patientData?.patient as Record<string, string> | undefined;
  const fullName = (patient?.full_name as string) || "Patient";
  const initials = fullName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "appointments", label: "Appointments",       Icon: Calendar  },
    { id: "prs",          label: "PRS Assessments",    Icon: Activity  },
    { id: "anamnesis",    label: "Anamnesis",           Icon: FileText  },
    { id: "permissions",  label: "Granted Permissions", Icon: Shield    },
  ];

  // ── render ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-50 dark:from-neutral-900 dark:to-neutral-950">

      {/* Top nav */}
      <div className="bg-white border-b border-neutral-200 px-8 py-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900 transition-colors text-sm font-medium"
        >
          <ChevronRight className="w-5 h-5 -scale-x-100" />
          Back to Patient
        </button>
      </div>

      <div className="px-8 py-8 space-y-6 max-w-6xl mx-auto">

        {/* Patient profile card */}
        {!patient && !patientErr ? (
          <div className="bg-white rounded-lg shadow-md p-7 animate-pulse">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-neutral-200 flex-shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-6 bg-neutral-200 rounded w-48" />
                <div className="h-4 bg-neutral-200 rounded w-64" />
                <div className="h-4 bg-neutral-200 rounded w-32" />
              </div>
            </div>
          </div>
        ) : patientErr ? (
          <SectionError msg={patientErr} />
        ) : (
          <div className="bg-white rounded-lg shadow-md p-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-orange-400 flex-shrink-0">
                  {initials}
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
                  {patient?.email && <p className="text-sm text-neutral-500 mt-0.5">{patient.email}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {patient?.date_of_birth && (
                      <span className="text-sm text-neutral-600">
                        {new Date().getFullYear() - new Date(patient.date_of_birth as string).getFullYear()} yrs
                      </span>
                    )}
                    {patient?.gender && (
                      <span className="text-sm text-neutral-600 capitalize">· {patient.gender}</span>
                    )}
                    {patient?.mrn && (
                      <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-xs rounded">
                        MRN: {patient.mrn}
                      </span>
                    )}
                    {patient?.approval_status && (
                      <span className={`px-2 py-0.5 text-xs rounded font-medium ${
                        patient.approval_status === "approved"
                          ? "bg-green-50 text-green-700"
                          : "bg-yellow-50 text-yellow-700"
                      }`}>
                        {statusLabel(patient.approval_status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Link
                href={`/doctor/patients/${id}`}
                className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors text-neutral-700 flex-shrink-0"
              >
                View Full Profile
              </Link>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map(({ id: tabId, label, Icon }) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === tabId
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">

          {/* ── Appointments ── */}
          {tab === "appointments" && (
            <div>
              {/* Filter bar */}
              <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3 flex-wrap">
                <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-neutral-500">From</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="text-sm border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-neutral-500">To</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="text-sm border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as AppointmentStatus | "")}
                  className="text-sm border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                >
                  <option value="">All Statuses</option>
                  {(["scheduled","confirmed","checked_in","completed","cancelled","no_show","rescheduled"] as const).map((s) => (
                    <option key={s} value={s}>{statusLabel(s)}</option>
                  ))}
                </select>
                {(filterDateFrom || filterDateTo || filterStatus) && (
                  <button
                    onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterStatus(""); }}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <span className="ml-auto text-xs text-neutral-400">
                  {filteredAppts.length} record{filteredAppts.length !== 1 ? "s" : ""}
                </span>
              </div>

              {apptLoading ? <SectionSkeleton /> : apptErr ? <SectionError msg={apptErr} /> : filteredAppts.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-neutral-400">No appointments found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        {["Date", "Time", "Type", "Reason", "Status"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredAppts.map((a) => (
                        <tr key={a.appointment_id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3 text-sm text-neutral-800 whitespace-nowrap">{formatDate(a.appointment_date)}</td>
                          <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">{fmt12(a.start_time)}</td>
                          <td className="px-5 py-3 text-sm text-neutral-600 capitalize">{(a.appointment_type || "—").replace(/_/g, " ")}</td>
                          <td className="px-5 py-3 text-sm text-neutral-600 max-w-[200px] truncate">{a.reason || "—"}</td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${APPT_BADGE[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {statusLabel(a.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── PRS Assessments ── */}
          {tab === "prs" && (
            <div className="divide-y divide-neutral-100">
              {prsLoading ? <SectionSkeleton /> : prsErr ? <SectionError msg={prsErr} /> : prsScores.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-neutral-400">No PRS assessments found</div>
              ) : prsScores.map((inst) => {
                const instanceId: string = inst.instance_id;
                const isOpen  = drillOpen === instanceId;
                const drill   = drillData[instanceId];
                const loading = drillLoading === instanceId;
                const severityLevel = inst.overall_severity ?? inst.severity_level;
                const severityLbl   = inst.overall_severity_label ?? inst.severity_label;

                return (
                  <div key={instanceId}>
                    <button
                      onClick={() => handleDrill(instanceId)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left gap-4"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 truncate">
                            {inst.disease_name || inst.disease_id || "Assessment"}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            Completed {formatDate(inst.completed_at ?? inst.time_stamp)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {severityLbl && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${severityBg(severityLevel)}`}>
                              {severityLbl}
                            </span>
                          )}
                          {(inst.percentage ?? inst.calculated_value) != null && (
                            <span className="text-sm font-bold text-neutral-900">
                              {inst.percentage != null ? `${inst.percentage.toFixed(0)}%` : inst.calculated_value}
                            </span>
                          )}
                        </div>
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-5 bg-neutral-50 border-t border-neutral-100">
                        {loading ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
                          </div>
                        ) : drill ? (
                          <div className="pt-4 space-y-4">
                            {drill.disease_result && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {drill.disease_result.percentage != null && (
                                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                                    <p className="text-xs text-neutral-500 mb-0.5">Score</p>
                                    <p className="text-xl font-bold text-neutral-900">
                                      {drill.disease_result.percentage.toFixed(0)}%
                                    </p>
                                  </div>
                                )}
                                {drill.disease_result.severity_label && (
                                  <div className="bg-white rounded-lg p-3 border border-neutral-200">
                                    <p className="text-xs text-neutral-500 mb-0.5">Severity</p>
                                    <p className={`text-sm font-semibold ${severityBg(drill.disease_result.severity_level).replace(/bg-\S+ /, "")}`}>
                                      {drill.disease_result.severity_label}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {drill.scale_results?.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                                  Scale Breakdown
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {drill.scale_results.map((sr) => (
                                    <div
                                      key={sr.scale_result_id ?? sr.scale_id}
                                      className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-neutral-200"
                                    >
                                      <span className="text-sm text-neutral-700 truncate">
                                        {sr.scale_name ?? sr.scale_code ?? sr.scale_id}
                                      </span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {sr.calculated_value != null && (
                                          <span className="text-sm font-semibold text-neutral-900">
                                            {sr.calculated_value}
                                            {sr.max_possible != null && (
                                              <span className="text-xs font-normal text-neutral-400">/{sr.max_possible}</span>
                                            )}
                                          </span>
                                        )}
                                        {sr.severity_label && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${severityBg(sr.severity_level)}`}>
                                            {sr.severity_label}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="py-4 text-sm text-neutral-400">Could not load details.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Anamnesis ── */}
          {tab === "anamnesis" && (
            <div className="p-6">
              {anamnesisLoading ? (
                <SectionSkeleton />
              ) : anamnesisErr ? (
                <SectionError msg={anamnesisErr} />
              ) : !anamnesis ? (
                <div className="py-12 text-center text-sm text-neutral-400">No anamnesis record found</div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">Anamnesis Record</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Status:{" "}
                      <span className={`font-medium ${anamnesis.status === "completed" ? "text-green-700" : "text-amber-700"}`}>
                        {statusLabel(anamnesis.status)}
                      </span>
                      {anamnesis.completed_at && ` · Completed ${formatDate(anamnesis.completed_at)}`}
                    </p>
                  </div>

                  {[
                    { label: "Chief Complaint",       value: anamnesis.chief_complaint },
                    { label: "Main Symptoms",          value: anamnesis.main_symptoms },
                    { label: "Initial Symptoms",       value: anamnesis.initial_symptoms },
                    { label: "Symptoms Onset",         value: anamnesis.symptoms_start },
                    { label: "Duration",               value: anamnesis.symptoms_duration },
                    { label: "Frequency",              value: anamnesis.symptoms_frequency },
                    { label: "Intensity",              value: anamnesis.symptoms_intensity },
                    { label: "Progression",            value: anamnesis.symptoms_progression },
                    { label: "Previous Treatments",    value: anamnesis.previous_treatments },
                    { label: "Current Medications",    value: anamnesis.current_medications },
                    { label: "Operations",             value: anamnesis.has_operations ? (anamnesis.operations_details || "Yes") : "No" },
                    { label: "Brain MRI",              value: anamnesis.has_brain_mri ? (anamnesis.mri_details || "Yes") : "No" },
                    { label: "Other Scans",            value: anamnesis.other_scans },
                    { label: "Neuromodulation",        value: anamnesis.has_neuromodulation ? (anamnesis.neuromodulation_details || "Yes") : "No" },
                    { label: "Diagnosis Related",      value: anamnesis.diagnosis_related ? (anamnesis.diagnosis_details || "Yes") : "No" },
                  ].filter((f) => f.value).map((field) => (
                    <div key={field.label} className="border-b border-neutral-100 pb-4">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">{field.label}</p>
                      <p className="text-sm text-neutral-800">{field.value}</p>
                    </div>
                  ))}

                  {anamnesis.secondary_symptoms && anamnesis.secondary_symptoms.length > 0 && (
                    <div className="border-b border-neutral-100 pb-4">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Secondary Symptoms</p>
                      <div className="flex flex-wrap gap-2">
                        {anamnesis.secondary_symptoms.map((s) => (
                          <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded">{s}</span>
                        ))}
                      </div>
                      {anamnesis.secondary_symptoms_details && (
                        <p className="text-sm text-neutral-800 mt-2">{anamnesis.secondary_symptoms_details}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Granted Permissions ── */}
          {tab === "permissions" && (
            <div>
              {!patientData ? (
                <SectionSkeleton />
              ) : (patientData.permissions ?? []).length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-neutral-400">No permissions granted yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-100">
                        {["Disease", "Status", "Granted", "Completed / Expires"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {(patientData.permissions ?? []).map((p) => (
                        <tr key={p.permission_id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-5 py-3 text-sm font-medium text-neutral-900">
                            {p.disease_name || p.disease_id}
                          </td>
                          <td className="px-5 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${PERM_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                              {statusLabel(p.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">
                            {formatDate(p.granted_at)}
                          </td>
                          <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">
                            {formatDate(p.completed_at ?? p.expires_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
