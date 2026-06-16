"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, CheckCircle, XCircle, Mail,
  Phone, Calendar, Clock, ChevronRight, Loader2,
} from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import { useAuth } from "@/lib/hooks";
import { Input, Card, CardContent, PageLoader } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";

export default function ReceptionistApprovalsPage() {
  const { user } = useAuth();
  const [patients, setPatients]           = useState<PatientListItem[]>([]);
  const [search, setSearch]               = useState("");
  const [isLoading, setIsLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal]     = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPending = useCallback(() => {
    setIsLoading(true);
    staffService
      .getPendingPatients()
      .then(({ patients: p }) => setPatients(p))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (patientId: string) => {
    setActionLoading(patientId);
    try {
      await staffService.approvePatient(patientId);
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      showToast("Patient approved successfully.", true);
    } catch {
      showToast("Failed to approve. Please try again.", false);
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      await staffService.rejectPatient(rejectModal.id, rejectReason || undefined);
      setPatients((prev) => prev.filter((p) => p.id !== rejectModal.id));
      setRejectModal(null);
      setRejectReason("");
      showToast("Registration rejected.", true);
    } catch {
      showToast("Failed to reject. Please try again.", false);
    }
    setActionLoading(null);
  };

  const filtered = patients.filter((p) =>
    `${p.full_name} ${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Self Registration Approvals</h1>
        {user?.clinic_name && (
          <p className="text-xs font-medium text-blue-600 mt-0.5">{user.clinic_name}</p>
        )}
        <p className="text-sm text-neutral-500 mt-0.5">
          {patients.length} pending {patients.length === 1 ? "request" : "requests"} — review and approve or reject
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map((p) => {
          const name = p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown Patient";
          const initials = (p.first_name?.[0] || p.full_name?.[0] || "?").toUpperCase() +
                           (p.last_name?.[0] || p.full_name?.split(" ")[1]?.[0] || "").toUpperCase();
          const isActioning = actionLoading === p.id;

          return (
            <Card key={p.id}>
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Avatar */}
                <Link href={`/receptionist/patients/${p.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                  <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                    {initials}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 group-hover:text-blue-700 transition-colors truncate">
                      {name}
                    </p>

                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="flex items-center gap-1 text-xs text-neutral-500">
                        <Mail className="h-3 w-3 text-neutral-400" />{p.email || "—"}
                      </span>
                      {p.phone && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Phone className="h-3 w-3 text-neutral-400" />{p.phone}
                        </span>
                      )}
                      {p.date_of_birth && (
                        <span className="flex items-center gap-1 text-xs text-neutral-500">
                          <Calendar className="h-3 w-3 text-neutral-400" />
                          {new Date(p.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
                      <Clock className="h-3 w-3" />
                      <span>Awaiting approval</span>
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500 flex-shrink-0 hidden sm:block" />
                </Link>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(p.id)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isActioning
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <CheckCircle className="h-3.5 w-3.5" />}
                    Approve
                  </button>
                  <button
                    onClick={() => setRejectModal({ id: p.id, name })}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-200 text-red-700 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <div className="px-6 py-14 text-center">
              <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="font-medium text-neutral-700">All caught up!</p>
              <p className="text-neutral-400 text-sm mt-1">No pending registration requests right now.</p>
            </div>
          </Card>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Reject Registration</h3>
            <p className="text-sm text-neutral-500">
              Rejecting will notify{" "}
              <span className="font-medium text-neutral-800">{rejectModal.name}</span>{" "}
              that their registration was not approved.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1.5">
                Reason <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason to help the patient understand…"
                rows={3}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 transition"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
