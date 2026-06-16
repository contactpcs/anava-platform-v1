"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { CheckCircle, Loader2, Building2, ChevronDown, Shield, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth, useClinics } from "@/lib/hooks";
import { register as registerThunk } from "@/store/slices/authSlice";
import { authService } from "@/lib/api/services/auth.service";
import type { ConsentFormItem, ConsentResponseItem } from "@/types/auth.types";

// ─── Schema ───────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  first_name:    z.string().min(1, "First name is required"),
  last_name:     z.string().min(1, "Last name is required"),
  email:         z.string().email("Please enter a valid email"),
  password:      z.string().min(8, "Password must be at least 8 characters"),
  phone:         z.string().min(1, "Phone is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender:        z.string().min(1, "Gender is required"),
  city:          z.string().min(1, "City is required"),
  state:         z.string().min(1, "State is required"),
  clinic_id:     z.string().min(1, "Please select your clinic"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const GENDER_OPTIONS = [
  { value: "",                  label: "Select…" },
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "other",             label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// ─── Shared label helper ──────────────────────────────────────────────────────

function FieldLabel({
  htmlFor,
  text,
  required,
  optional,
}: {
  htmlFor: string;
  text: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1.5">
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {optional && (
        <span className="ml-1 text-xs font-normal text-neutral-400">(optional)</span>
      )}
    </label>
  );
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400";

const inputErrCls =
  "w-full rounded-lg border border-danger-400 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-danger-500/20 focus:border-danger-500";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-danger-600">{msg}</p>;
}

// ─── Smart clinic filter helper ───────────────────────────────────────────────
function getFilteredClinics(allClinics: any[], userCity?: string, userState?: string) {
  if (!allClinics.length) return allClinics;

  const userCityLower = userCity?.toLowerCase().trim() || "";
  const userStateLower = userState?.toLowerCase().trim() || "";

  if (!userCityLower && !userStateLower) {
    return allClinics;
  }

  if (userCityLower) {
    const cityClinics = allClinics.filter(
      (c) => c.city?.toLowerCase().trim() === userCityLower
    );
    if (cityClinics.length > 0) return cityClinics;
  }

  if (userStateLower) {
    const stateClinics = allClinics.filter(
      (c) => c.state?.toLowerCase().trim() === userStateLower
    );
    if (stateClinics.length > 0) return stateClinics;
  }

  return allClinics;
}

// ─── Consent modal ────────────────────────────────────────────────────────────

function ConsentModal({
  isOpen,
  onClose,
  onAccept,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccept: (responses: ConsentResponseItem[]) => void;
  isLoading: boolean;
}) {
  const [apiForms, setApiForms] = useState<ConsentFormItem[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formsError, setFormsError] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

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
  const allRequired = apiForms.length > 0 && requiredForms.every((f) => checked[f.consent_form_id]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-neutral-900 leading-tight">
                Data Privacy Consent
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">Anava</p>
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
            By creating an account on the{" "}
            <strong className="text-neutral-700">Anava</strong>, you
            acknowledge and agree to the following. Please read carefully before
            submitting your registration.
          </p>

          {/* 1 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">
              1. Information you are providing
            </h4>
            <p className="text-neutral-600 leading-relaxed">
              You are submitting personal information (name, date of birth, gender, email,
              phone, address, emergency contact) and health-related information (medical
              history, current medications, symptoms) so that your registering clinic can
              provide you with care.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-2">
              2. How your information will be used
            </h4>
            <ul className="space-y-1.5 text-neutral-600">
              {[
                "Identify you as a patient and create your Electronic Medical Record (EMR)",
                "Allocate you to a treating doctor at your registering clinic",
                "Administer clinical assessments (Patient Rating Scales) to support your diagnosis and care",
                "Communicate with you about appointments, results, and account status",
                "Improve the Platform through anonymized, aggregated analytics",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* 3 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">
              3. Who can access your information
            </h4>
            <p className="text-neutral-600 leading-relaxed">
              Only authorized staff at your registering clinic — your treating doctor,
              clinical assistant, receptionist, and clinic administrator — can access your
              data on a role-based, need-to-know basis. All access is logged. Your data is{" "}
              <strong className="text-neutral-800">isolated to your clinic</strong> and is
              not visible to other clinics on the Platform.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-2">4. Your rights</h4>
            <p className="text-neutral-600 mb-2">You may at any time:</p>
            <ul className="space-y-1.5 text-neutral-600">
              {[
                "Access a copy of your data",
                "Correct inaccurate personal information",
                "Withdraw this consent (which will end your active use of the Platform)",
                "Restrict how your data is used",
                "Port your data to another healthcare provider",
                "Lodge a complaint with the relevant data protection authority",
              ].map((r) => (
                <li key={r} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                  {r}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-neutral-400">
              To exercise any right, contact your registering clinic.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">
              5. Sharing with third parties
            </h4>
            <p className="text-neutral-600 leading-relaxed">
              Your identifiable data will{" "}
              <strong className="text-neutral-800">not</strong> be shared with third
              parties except: (a) as required by law, (b) with your separate written
              consent, (c) with trusted infrastructure providers strictly to operate the
              Platform under confidentiality agreements, or (d) in a medical emergency.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h4 className="font-semibold text-neutral-900 mb-1.5">6. Research</h4>
            <p className="text-neutral-600 leading-relaxed">
              Standard registration does{" "}
              <strong className="text-neutral-800">not</strong> consent to research use of
              your data. Any research participation requires separate, specific written
              consent.
            </p>
          </section>

          {/* ── Consent form checkboxes (API-driven) ────────────────────────── */}
          <div className="border-t border-neutral-200 pt-5">
            <p className="font-semibold text-neutral-900 mb-1">Required consent forms</p>
            <p className="text-xs text-neutral-400 mb-4">
              All required forms must be accepted before you can submit your registration.
            </p>

            {formsLoading && (
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Loading consent forms…
              </div>
            )}

            {formsError && (
              <p className="text-sm text-danger-600 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
                {formsError}
              </p>
            )}

            {!formsLoading && !formsError && (
              <div className="space-y-3">
                {apiForms.map((f) => (
                  <label
                    key={f.consent_form_id}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[f.consent_form_id]}
                      onChange={() => toggle(f.consent_form_id)}
                      className="mt-0.5 w-4 h-4 flex-shrink-0 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-neutral-700 leading-snug text-sm group-hover:text-neutral-900 transition-colors">
                      I have read and accept the{" "}
                      <strong className="text-neutral-900">{f.consent_form_name}</strong>
                      {f.is_required && (
                        <span className="ml-1.5 text-xs font-semibold text-danger-600 bg-danger-50 px-1.5 py-0.5 rounded">
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
            Cancel
          </button>
          <Button
            onClick={handleAccept}
            disabled={!allRequired || formsLoading || !!formsError}
            isLoading={isLoading}
            size="sm"
          >
            Submit Registration
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const { isLoading, error, clearError, register } = useAuth();
  const { clinics, isLoading: clinicsLoading } = useClinics();
  const [successClinic, setSuccessClinic] = useState<string | null>(null);
  const [showConsent, setShowConsent]     = useState(false);
  const [pendingData, setPendingData]     = useState<RegisterFormData | null>(null);

  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { gender: "" },
  });

  const selectedClinicId = watch("clinic_id");
  const userCity         = watch("city");
  const userState        = watch("state");
  const selectedClinic   = clinics.find((c) => c.clinic_id === selectedClinicId);
  const filteredClinics  = getFilteredClinics(clinics, userCity, userState);

  // Validate form → open consent modal (no API call yet)
  const onSubmit = (data: RegisterFormData) => {
    clearError();
    setPendingData(data);
    setShowConsent(true);
  };

  // Called from inside the consent modal after all required forms are accepted
  const handleConsentAccepted = async (consentResponses: ConsentResponseItem[]) => {
    if (!pendingData) return;
    const result = await register({ ...pendingData, consent_responses: consentResponses });
    if (registerThunk.fulfilled.match(result)) {
      setShowConsent(false);
      setSuccessClinic(
        selectedClinic?.clinic_name ?? (result.payload as string) ?? "your clinic"
      );
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successClinic) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Registration Submitted!
          </h2>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
            Your account has been submitted to{" "}
            <span className="font-semibold text-neutral-700">{successClinic}</span> for
            review. A receptionist will approve your account shortly.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          You will be able to log in once your account is approved.
        </div>
        <Link
          href="/login"
          className="inline-block w-full text-center py-3 px-4 rounded-lg bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  // ── Registration form ───────────────────────────────────────────────────────
  return (
    <>
      <div className="w-full">
        {/* Heading */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Create account</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Patient self-registration — Anava PRS
          </p>
        </div>

        {/* API error */}
        {error && (
          <div className="mb-4 bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

          {/* ── Name ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="first_name" text="First name" required />
              <input
                id="first_name"
                placeholder="Jane"
                autoComplete="given-name"
                {...field("first_name")}
                className={errors.first_name ? inputErrCls : inputCls}
              />
              <FieldError msg={errors.first_name?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="last_name" text="Last name" required />
              <input
                id="last_name"
                placeholder="Smith"
                autoComplete="family-name"
                {...field("last_name")}
                className={errors.last_name ? inputErrCls : inputCls}
              />
              <FieldError msg={errors.last_name?.message} />
            </div>
          </div>

          {/* ── Email ────────────────────────────────────────────────────── */}
          <div>
            <FieldLabel htmlFor="email" text="Email address" required />
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...field("email")}
              className={errors.email ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.email?.message} />
          </div>

          {/* ── Password ─────────────────────────────────────────────────── */}
          <div>
            <FieldLabel htmlFor="password" text="Password" required />
            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              autoComplete="new-password"
              {...field("password")}
              className={errors.password ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.password?.message} />
          </div>

          {/* ── Phone ────────────────────────────────────────────────────── */}
          <div>
            <FieldLabel htmlFor="phone" text="Phone" required />
            <input
              id="phone"
              type="tel"
              placeholder="+91 98765 43210"
              autoComplete="tel"
              {...field("phone")}
              className={errors.phone ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.phone?.message} />
          </div>

          {/* ── Date of birth + Gender ───────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="date_of_birth" text="Date of birth" required />
              <input
                id="date_of_birth"
                type="date"
                {...field("date_of_birth")}
                className={errors.date_of_birth ? inputErrCls : inputCls}
              />
              <FieldError msg={errors.date_of_birth?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="gender" text="Gender" required />
              <div className="relative">
                <select
                  id="gender"
                  {...field("gender")}
                  className={`${errors.gender ? inputErrCls : inputCls} appearance-none pr-9`}
                >
                  {GENDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
              <FieldError msg={errors.gender?.message} />
            </div>
          </div>

          {/* ── City + State ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="city" text="City" required />
              <input
                id="city"
                placeholder="Mumbai"
                {...field("city")}
                className={errors.city ? inputErrCls : inputCls}
              />
              <FieldError msg={errors.city?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="state" text="State" required />
              <input
                id="state"
                placeholder="Maharashtra"
                {...field("state")}
                className={errors.state ? inputErrCls : inputCls}
              />
              <FieldError msg={errors.state?.message} />
            </div>
          </div>

          {/* ── Clinic ───────────────────────────────────────────────────── */}
          <div>
            <FieldLabel htmlFor="clinic_id" text="Clinic" required />
            {clinicsLoading ? (
              <div className="flex items-center gap-2 h-10 px-3.5 border border-neutral-300 rounded-lg text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                Loading clinics…
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <select
                  id="clinic_id"
                  {...field("clinic_id")}
                  className={`w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400 transition-all ${errors.clinic_id ? "border-danger-400" : "border-neutral-300"} text-neutral-900`}
                >
                  <option value="">Select your clinic…</option>
                  {filteredClinics.map((c) => (
                    <option key={c.clinic_id} value={c.clinic_id}>
                      {c.clinic_name}{c.city ? ` — ${c.city}` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
            )}
            <FieldError msg={errors.clinic_id?.message} />
            {selectedClinic?.address && (
              <p className="mt-1 text-xs text-neutral-400">
                {selectedClinic.address}{selectedClinic.state ? `, ${selectedClinic.state}` : ""}
              </p>
            )}
          </div>

          {/* ── Privacy notice hint ──────────────────────────────────────── */}
          <div className="flex items-start gap-2 text-xs text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5">
            <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-400" />
            <span>
              Clicking <strong className="text-neutral-600">Continue</strong> will show
              you our Data Privacy Consent before your registration is submitted.
            </span>
          </div>

          {/* ── Submit ───────────────────────────────────────────────────── */}
          <Button type="submit" className="w-full" size="lg" isLoading={false}>
            Continue
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Consent modal — rendered outside the form so z-index stacking is clean */}
      <ConsentModal
        isOpen={showConsent}
        onClose={() => setShowConsent(false)}
        onAccept={handleConsentAccepted}
        isLoading={isLoading}
      />
    </>
  );
}
