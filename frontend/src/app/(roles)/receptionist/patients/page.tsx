"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin, UserPlus, X, ChevronRight, Loader2, Users, ClipboardCheck, Shield } from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import type { RegisterPatientPayload } from "@/lib/api/services/staff.service";
import { authService } from "@/lib/api/services/auth.service";
import { useStaffPatients, useClinics } from "@/lib/hooks";
import { Input, Card, PageLoader, Button } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";
import type { ConsentFormItem, ConsentResponseItem } from "@/types/auth.types";

// "pending" is intentionally excluded — pending patients appear only in the Approvals tab
const STATUS_FILTERS = ["all", "approved", "rejected"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const EMPTY_FORM: RegisterPatientPayload = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  city: "",
  state: "",
};

function getStatusStyle(status?: string) {
  switch (status) {
    case "approved": return "bg-green-50 text-green-700";
    case "pending":  return "bg-amber-50 text-amber-700";
    case "rejected": return "bg-red-50 text-red-600";
    default:         return "bg-neutral-100 text-neutral-500";
  }
}

// ─── Data Privacy Consent Modal (receptionist flow) ──────────────────────────
function ConsentModal({
  isOpen,
  saving,
  onClose,
  onAccept,
}: {
  isOpen: boolean;
  saving: boolean;
  onClose: () => void;
  onAccept: (responses: ConsentResponseItem[]) => void;
}) {
  const [apiForms, setApiForms]     = useState<ConsentFormItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState("");
  const [checked, setChecked]       = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    setFormsLoading(true);
    setFormsError("");
    authService.getConsentForms()
      .then((forms) => {
        setApiForms(forms);
        const init: Record<string, boolean> = {};
        forms.forEach((f) => { init[f.consent_form_id] = false; });
        setChecked(init);
      })
      .catch(() => setFormsError("Failed to load consent forms. Please close and try again."))
      .finally(() => setFormsLoading(false));
  }, [isOpen]);

  const requiredForms = apiForms.filter((f) => f.is_required);
  const allRequired   = apiForms.length > 0 && requiredForms.every((f) => checked[f.consent_form_id]);

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleAccept = () => {
    const responses: ConsentResponseItem[] = apiForms.map((f) => ({
      consent_form_id: f.consent_form_id,
      response: !!checked[f.consent_form_id],
    }));
    onAccept(responses);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 leading-tight">Data Privacy Consent</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Anava — patient must consent before registration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors p-1 rounded-md hover:bg-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm">
          <p className="text-neutral-500 text-xs leading-relaxed bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
            By creating an account on the <strong className="text-neutral-700">Anava</strong>,
            the patient acknowledges and agrees to the following. Please read to the patient carefully before submitting.
          </p>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">1. Information being provided</h4>
            <p className="text-neutral-600 leading-relaxed">
              Personal information (name, date of birth, gender, email, phone, address) and health-related information
              (medical history, current medications, symptoms) so that the registering clinic can provide care.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-2">2. How information will be used</h4>
            <ul className="space-y-1.5 text-neutral-600">
              {[
                "Identify the patient and create an Electronic Medical Record (EMR)",
                "Allocate to a treating doctor at the registering clinic",
                "Administer clinical assessments (Patient Rating Scales) to support diagnosis and care",
                "Communicate about appointments, results, and account status",
                "Improve the Platform through anonymized, aggregated analytics",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">3. Who can access the information</h4>
            <p className="text-neutral-600 leading-relaxed">
              Only authorized staff at the registering clinic — treating doctor, clinical assistant, receptionist, and
              clinic administrator — can access data on a role-based, need-to-know basis. All access is logged. Data is{" "}
              <strong className="text-neutral-800">isolated to the clinic</strong> and not visible to other clinics.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-2">4. Patient rights</h4>
            <p className="text-neutral-600 mb-2">The patient may at any time:</p>
            <ul className="space-y-1.5 text-neutral-600">
              {[
                "Access a copy of their data",
                "Correct inaccurate personal information",
                "Withdraw this consent (which will end active use of the Platform)",
                "Restrict how data is used",
                "Port data to another healthcare provider",
                "Lodge a complaint with the relevant data protection authority",
              ].map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-neutral-400">To exercise any right, contact the registering clinic.</p>
          </section>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">5. Sharing with third parties</h4>
            <p className="text-neutral-600 leading-relaxed">
              Identifiable data will <strong className="text-neutral-800">not</strong> be shared with third parties
              except: (a) as required by law, (b) with separate written consent, (c) with trusted infrastructure
              providers under confidentiality agreements, or (d) in a medical emergency.
            </p>
          </section>

          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">6. Research</h4>
            <p className="text-neutral-600 leading-relaxed">
              Standard registration does <strong className="text-neutral-800">not</strong> consent to research use of
              data. Any research participation requires separate, specific written consent.
            </p>
          </section>

          {/* API-driven consent checkboxes */}
          <div className="border-t border-neutral-200 pt-5">
            <p className="font-semibold text-neutral-900 mb-1">Required consent forms</p>
            <p className="text-xs text-neutral-400 mb-4">
              All required forms must be accepted before the patient can be registered.
            </p>

            {formsLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Loading consent forms…
              </div>
            )}

            {formsError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formsError}</p>
            )}

            {!formsLoading && !formsError && (
              <div className="space-y-3">
                {apiForms.map((f) => (
                  <label key={f.consent_form_id} className="flex items-start gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!checked[f.consent_form_id]}
                      onChange={() => toggle(f.consent_form_id)}
                      className="mt-0.5 w-4 h-4 flex-shrink-0 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span className="text-neutral-700 leading-snug text-sm group-hover:text-neutral-900 transition-colors">
                      I have read and accept the{" "}
                      <strong className="text-neutral-900">{f.consent_form_name}</strong>
                      {f.is_required && (
                        <span className="ml-1.5 text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          Required
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0 rounded-b-xl bg-neutral-50">
          <button
            onClick={onClose}
            className="text-sm text-neutral-600 hover:text-neutral-900 transition-colors px-3 py-2 rounded-lg hover:bg-neutral-100"
          >
            Back
          </button>
          <button
            onClick={handleAccept}
            disabled={!allRequired || formsLoading || !!formsError || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {saving ? "Registering…" : "Register Patient"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Register Patient Modal ───────────────────────────────────────────────────
function RegisterModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (p: PatientListItem) => void;
}) {
  const [form, setForm]           = useState<RegisterPatientPayload>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);

  const set = (field: keyof RegisterPatientPayload, val: string) =>
    setForm((f) => ({ ...f, [field]: val }));

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setErr("Full name, email, and password are required.");
      return;
    }
    if (!form.phone.trim() || !form.date_of_birth || !form.gender) {
      setErr("Phone, date of birth, and gender are required.");
      return;
    }
    if (!form.city.trim() || !form.state.trim()) {
      setErr("City and state are required.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setErr(null);
    setShowConsent(true);
  };

  const handleConsentAccepted = async (consentResponses: ConsentResponseItem[]) => {
    setSaving(true);
    setErr(null);
    try {
      const patient = await staffService.registerPatient({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        city: form.city.trim(),
        state: form.state.trim(),
        consent_responses: consentResponses,
      });
      onSuccess(patient);
    } catch (e: any) {
      setShowConsent(false);
      setErr(e?.response?.data?.detail || "Failed to register patient. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
            <h2 className="text-lg font-semibold text-neutral-900">Register New Patient</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleContinue} className="px-6 py-5 space-y-4">
            {err && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={form.full_name}
                  onChange={(e) => set("full_name", e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="patient@example.com"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Initial Password <span className="text-red-500">*</span>
                </label>
                <Input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  minLength={8}
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">Share this securely with the patient — they can change it after first login.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Phone <span className="text-red-500">*</span></label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Date of Birth <span className="text-red-500">*</span></label>
                <Input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set("date_of_birth", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">City <span className="text-red-500">*</span></label>
                <Input
                  placeholder="e.g. Mumbai"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">State <span className="text-red-500">*</span></label>
                <Input
                  placeholder="e.g. Maharashtra"
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Gender <span className="text-red-500">*</span></label>
                <select
                  value={form.gender}
                  onChange={(e) => set("gender", e.target.value)}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                  required
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Privacy notice hint */}
            <div className="flex items-start gap-2 text-xs text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5">
              <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-400" />
              <span>
                Clicking <strong className="text-neutral-600">Continue</strong> will open the Data Privacy Consent form.
                The patient must consent before the account is created.
              </span>
            </div>

            <div className="flex gap-3 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConsentModal
        isOpen={showConsent}
        saving={saving}
        onClose={() => setShowConsent(false)}
        onAccept={handleConsentAccepted}
      />
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReceptionistPatientsPage() {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal]       = useState(false);
  const { patients, isLoading: patientsLoading } = useStaffPatients();
  const { clinics, isLoading: clinicsLoading } = useClinics();

  const isLoading = patientsLoading || clinicsLoading;

  function clinicName(clinicId?: string): string | null {
    if (!clinicId) return null;
    const c = clinics.find((x) => x.clinic_id === clinicId);
    return c?.clinic_name || c?.city || null;
  }

  const filtered = patients.filter((p) => {
    // Pending patients are exclusively shown in the Approvals tab — never in this list
    if ((p.status ?? "").toLowerCase() === "pending") return false;
    const clinic = clinicName(p.clinic_id) ?? p.clinic_name ?? p.clinic_city ?? "";
    const haystack = `${p.full_name} ${p.email} ${p.phone ?? ""} ${p.mrn ?? ""} ${clinic}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleRegistered = (_patient: PatientListItem) => {
    setShowModal(false);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">All Patients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{patients.length} registered patients</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="flex-shrink-0">
          <UserPlus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">Register Patient</span><span className="sm:hidden">Register</span>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search by name, email, phone or clinic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      <Card>
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-neutral-100 bg-neutral-50 rounded-t-xl">
          {["Patient", "Contact", "Clinic", "Registered", "Status", ""].map((h) => (
            <span key={h} className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-neutral-100">
          {filtered.map((p) => {
            const name    = p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown Patient";
            const initials =
              ((p.first_name?.[0] || p.full_name?.[0] || "?") +
               (p.last_name?.[0]  || p.full_name?.split(" ")[1]?.[0] || "")).toUpperCase();
            const clinic  = clinicName(p.clinic_id) ?? p.clinic_name ?? p.clinic_city;
            const regDate = p.registered_at || p.created_at;

            return (
              <Link
                key={p.id}
                href={`/receptionist/patients/${p.id}`}
                className="grid md:grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-blue-50/40 transition-colors group"
              >
                {/* Patient name + gender */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-blue-700">{name}</p>
                    {p.gender && (
                      <p className="text-xs text-neutral-400 capitalize mt-0.5">{p.gender}</p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="min-w-0">
                  <p className="text-xs text-neutral-700 truncate">{p.email || "—"}</p>
                  {p.phone && <p className="text-xs text-neutral-400 mt-0.5">{p.phone}</p>}
                </div>

                {/* Clinic */}
                <div>
                  {clinic ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <MapPin className="h-3 w-3 flex-shrink-0" />{clinic}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Registered date */}
                <div>
                  {regDate ? (
                    <span className="text-xs text-neutral-500">
                      {new Date(regDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  {p.status ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyle(p.status)}`}>
                      {p.status}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex justify-end">
                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-neutral-400">
              <Users className="h-8 w-8 text-neutral-200" />
              <p className="text-sm">
                {patients.length === 0 ? "No patients registered yet." : "No patients match your search."}
              </p>
            </div>
          )}
        </div>
      </Card>

      {showModal && (
        <RegisterModal onClose={() => setShowModal(false)} onSuccess={handleRegistered} />
      )}
    </div>
  );
}
