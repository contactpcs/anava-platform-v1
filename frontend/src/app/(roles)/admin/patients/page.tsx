"use client";

import { useEffect, useState } from "react";
import {
  Users, Search, X, Check, XCircle, Trash2,
  Clock, Building2, Calendar, Filter,
} from "lucide-react";
import { useAdminPatients, useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton, Modal } from "@/components/ui";
import type { AdminPatient } from "@/types/admin.types";

// ─── Skeleton ─────────────────────────────────────────────────────

function PatientsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdminPatient["approval_status"] }) {
  const map = {
    pending:  { bg: "bg-amber-100",  text: "text-amber-700",  icon: Clock,    label: "Pending" },
    approved: { bg: "bg-green-100",  text: "text-green-700",  icon: Check,    label: "Approved" },
    rejected: { bg: "bg-red-100",    text: "text-red-600",    icon: XCircle,  label: "Rejected" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────

function ConfirmDelete({ patient, onConfirm, onClose }: {
  patient: AdminPatient;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function confirm() {
    setLoading(true);
    try { await onConfirm(); onClose(); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Permanently delete <strong>{patient.first_name} {patient.last_name}</strong>? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
          onClick={confirm}
        >
          {loading ? "Deleting…" : "Delete Patient"}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminPatientsPage() {
  const { patients, isLoading, error, fetch, approvePatient, rejectPatient, deletePatient } = useAdminPatients();
  const { clinics, fetch: fetchClinics } = useAdminClinics();

  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminPatient | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => { fetch(); fetchClinics(); }, [fetch, fetchClinics]);

  const pendingCount  = patients.filter((p) => p.approval_status === "pending").length;
  const approvedCount = patients.filter((p) => p.approval_status === "approved").length;
  const rejectedCount = patients.filter((p) => p.approval_status === "rejected").length;

  const filtered = patients.filter((p) => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.mrn ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesClinic = clinicFilter === "all" || p.clinic_id === clinicFilter;
    const matchesTab = tab === "all" || p.approval_status === tab;
    return matchesSearch && matchesClinic && matchesTab;
  });

  async function handleApprove(id: string) {
    setProcessingId(id);
    setActionError(null);
    try { await approvePatient(id); } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to approve patient");
    } finally { setProcessingId(null); }
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    setActionError(null);
    try { await rejectPatient(id); } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to reject patient");
    } finally { setProcessingId(null); }
  }

  const initials = (p: AdminPatient) =>
    [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));

  if (isLoading) return <PatientsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{patients.length} total patients</p>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        {([
          { key: "all",      label: "All",      count: patients.length },
          { key: "pending",  label: "Pending",  count: pendingCount  },
          { key: "approved", label: "Approved", count: approvedCount },
          { key: "rejected", label: "Rejected", count: rejectedCount },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
              tab === t.key ? "bg-blue-100 text-blue-700" : "bg-neutral-200 text-neutral-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, MRN…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}
        </div>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Clinics</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Patient Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No patients found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : `No ${tab === "all" ? "" : tab + " "}patients`}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">DOB / Gender</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs flex-shrink-0">
                          {initials(patient)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">{patient.email}</p>
                          {patient.mrn && (
                            <p className="text-[10px] text-neutral-400 font-mono">MRN: {patient.mrn}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Building2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <span className="truncate max-w-[130px]">{patient.clinic_name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-neutral-600 space-y-0.5">
                        {patient.date_of_birth && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-neutral-400" />
                            {new Date(patient.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        )}
                        {patient.gender && (
                          <span className="capitalize text-neutral-500">{patient.gender}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={patient.approval_status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {patient.approval_status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(patient.id)}
                              disabled={processingId === patient.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(patient.id)}
                              disabled={processingId === patient.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {patient.approval_status === "rejected" && (
                          <button
                            onClick={() => handleApprove(patient.id)}
                            disabled={processingId === patient.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(patient)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Delete modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Patient">
        {deleteTarget && (
          <ConfirmDelete
            patient={deleteTarget}
            onConfirm={() => deletePatient(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}
