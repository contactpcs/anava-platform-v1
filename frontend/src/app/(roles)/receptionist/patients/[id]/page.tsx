"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Mail, Phone, Calendar, MapPin,
  Stethoscope, CheckCircle, XCircle, Loader2, UserCheck,
  Heart, AlertCircle, ClipboardList,
} from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import { useStaffPatient, useClinics } from "@/lib/hooks";
import { Card, CardHeader, CardContent, PageLoader } from "@/components/ui";
import type { PatientDetail, DoctorListItem } from "@/types/domain.types";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div>
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function statusBadge(status?: string) {
  switch (status) {
    case "active":   return "bg-green-50 text-green-700 border-green-200";
    case "pending":  return "bg-amber-50 text-amber-700 border-amber-200";
    case "inactive": return "bg-neutral-100 text-neutral-600 border-neutral-200";
    default:         return "bg-neutral-100 text-neutral-500 border-neutral-200";
  }
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doctors, setDoctors]         = useState<DoctorListItem[]>([]);
  const [isLoading, setIsLoading]     = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [allocating, setAllocating]   = useState(false);
  const [allocated, setAllocated]     = useState(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // Patient from cache, doctors fresh (less critical to cache), clinics from catalog.
  const patient = useStaffPatient(id);
  const { clinics } = useClinics();

  // Resolve clinic name reactively.
  const resolvedClinic: string | null = (() => {
    if (!patient?.clinic_id) return null;
    const match = clinics.find((c) => c.clinic_id === patient.clinic_id);
    return match?.clinic_name || match?.city || null;
  })();

  useEffect(() => {
    staffService.getDoctors()
      .then(({ doctors: d }) => setDoctors(d))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAllocate = async () => {
    if (!selectedDoctor) return;
    setAllocating(true);
    try {
      await staffService.allocatePatient(id, selectedDoctor);
      setAllocated(true);
      showToast("Patient successfully allocated to doctor.", true);
    } catch {
      showToast("Failed to allocate patient. Please try again.", false);
    } finally {
      setAllocating(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      await staffService.approvePatient(id);
      showToast("Patient approved successfully.", true);
    } catch {
      showToast("Failed to approve patient.", false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading("reject");
    try {
      await staffService.rejectPatient(id, rejectReason || undefined);
      setRejectModal(false);
      showToast("Patient registration rejected.", true);
    } catch {
      showToast("Failed to reject patient.", false);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!patient)  return (
    <div className="text-center py-20 text-neutral-400">Patient not found.</div>
  );

  const name    = patient.full_name || `${patient.first_name} ${patient.last_name}`.trim() || "Unknown";
  const initials = (patient.first_name?.[0] || name[0] || "?").toUpperCase() +
                   (patient.last_name?.[0]  || name.split(" ")[1]?.[0] || "").toUpperCase();
  const isPending = patient.status === "pending";
  const clinic = resolvedClinic || patient.clinic_name || patient.clinic_city;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </button>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white transition-all ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Patient header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4 py-5">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-neutral-900">{name}</h1>
            {clinic && (
              <p className="flex items-center gap-1 text-xs text-blue-600 font-medium mt-0.5">
                <MapPin className="h-3 w-3" />{clinic}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {patient.status && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${statusBadge(patient.status)}`}>
                {patient.status}
              </span>
            )}
            {patient.mrn && (
              <span className="px-3 py-1 rounded-full text-xs font-mono bg-neutral-100 text-neutral-600">
                MRN: {patient.mrn}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Approve / Reject actions for pending patients */}
      {isPending && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">Pending Registration Approval</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                This patient self-registered and is waiting for your review.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "approve"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle className="h-3.5 w-3.5" />}
                Approve
              </button>
              <button
                onClick={() => setRejectModal(true)}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Contact Information</h3></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Mail}     label="Email"         value={patient.email} />
            <InfoRow icon={Phone}    label="Phone"         value={patient.phone} />
            <InfoRow icon={Calendar} label="Date of Birth"
              value={patient.date_of_birth
                ? new Date(patient.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                : null}
            />
            <InfoRow icon={User}     label="Gender"
              value={patient.gender
                ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
                : null}
            />
            {clinic && <InfoRow icon={MapPin} label="Clinic" value={clinic} />}
          </CardContent>
        </Card>

        {/* Allocate to Doctor */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-neutral-700">Allocate to Doctor</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {allocated ? (
              <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                <UserCheck className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-700">Doctor allocated successfully!</p>
                <button
                  onClick={() => { setAllocated(false); setSelectedDoctor(""); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reallocate
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-500">
                  Assign this patient to an available doctor at your clinic.
                </p>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Select Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                  >
                    <option value="">— Choose a doctor —</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.first_name} {d.last_name}
                        {d.specialization ? ` — ${d.specialization}` : ""}
                        {` (${d.patient_count} patients)`}
                      </option>
                    ))}
                  </select>
                </div>

                {doctors.length === 0 && (
                  <p className="text-xs text-neutral-400">No doctors available. Contact admin.</p>
                )}

                <button
                  onClick={handleAllocate}
                  disabled={!selectedDoctor || allocating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {allocating
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Allocating…</>
                    : <><Stethoscope className="h-3.5 w-3.5" />Allocate Doctor</>}
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Medical Information */}
      {(patient.medical_history || patient.emergency_contact || patient.blood_group) && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Medical Information</h3></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={AlertCircle} label="Emergency Contact" value={patient.emergency_contact} />
            <InfoRow icon={Heart}       label="Blood Group"       value={patient.blood_group} />
            {patient.medical_history && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-400">Medical History</p>
                  <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {patient.medical_history}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      {patient.recent_sessions && patient.recent_sessions.length > 0 && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Recent Sessions</h3></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-100">
                  <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Title</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {patient.recent_sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3 text-neutral-700">
                        {s.session_date
                          ? new Date(s.session_date).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-neutral-700">{s.title || "—"}</td>
                      <td className="px-5 py-3 text-neutral-600 capitalize">{s.session_type || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${statusBadge(s.status)}`}>
                          {s.status || "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Reject Registration</h3>
            <p className="text-sm text-neutral-500">
              Rejecting will notify <span className="font-medium text-neutral-800">{name}</span> that their registration was not approved.
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
                onClick={() => { setRejectModal(false); setRejectReason(""); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === "reject"}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "reject" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
