"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, ShoppingBag, CreditCard, Bell, Settings,
  Check, X, AlertCircle, Plus, Stethoscope, Edit2,
} from "lucide-react";
import { PageLoader } from "@/components/ui";
import { usersService } from "@/lib/api/services/users.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateUserInStore } from "@/store/slices/authSlice";
import { fetchMyDoctor, selectMyDoctor } from "@/store/slices/patientsSlice";

// ─── helpers ──────────────────────────────────────────────────────

function computeAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age;
}

function buildDiff(
  current: Record<string, string>,
  original: Record<string, string>,
): Record<string, string> {
  const diff: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== (original[k] ?? "")) diff[k] = v;
  }
  return diff;
}

const EMPTY_FORM = {
  full_name: "",
  date_of_birth: "", gender: "",
  government_id: "", id_type: "", language_pref: "",
  address_line1: "", city: "", state: "", country: "", pincode: "",
  blood_group: "", allergies: "", emergency_contact: "",
  occupation: "", marital_status: "",
  insurance_provider: "", insurance_policy: "",
  weight_kg: "", height_ft: "", height_in: "",
};

type FormState = typeof EMPTY_FORM;
type TabId = "overview" | "purchases" | "payments" | "notifications" | "settings";

// ─── styles ───────────────────────────────────────────────────────

const BRAND_PRIMARY = "#00A1E4";
const BRAND = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";
const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:border-sky-400 hover:border-neutral-300";
const labelCls = "text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 block";

function FieldInput({
  label, value, onChange, type = "text", placeholder, readOnly,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        className={readOnly ? `${inputCls} bg-neutral-50 cursor-default` : inputCls}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// read-only display row (label → value table style)
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-400 flex-shrink-0 w-40">{label}</span>
      <span className="text-sm font-semibold text-neutral-900 text-right">{value || "—"}</span>
    </div>
  );
}

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "overview",      label: "Overview",      Icon: User        },
  { id: "purchases",     label: "Purchases",     Icon: ShoppingBag },
  { id: "payments",      label: "Payments",      Icon: CreditCard  },
  { id: "notifications", label: "Notifications", Icon: Bell        },
  { id: "settings",      label: "Settings",      Icon: Settings    },
];

// ─── component ────────────────────────────────────────────────────

export default function PatientProfilePage() {
  const dispatch   = useAppDispatch();
  const myDoctor   = useAppSelector(selectMyDoctor);

  const [profileRaw,  setProfileRaw]  = useState<Record<string, unknown> | null>(null);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [isEditing,   setIsEditing]   = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeTab,   setActiveTab]   = useState<TabId>("overview");
  const [settings,    setSettings]    = useState({
    emailReminders: true, weeklyReport: true, shareData: true, darkMode: false,
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const originalRef     = useRef<FormState>(EMPTY_FORM);

  useEffect(() => {
    dispatch(fetchMyDoctor());
    usersService.getProfile()
      .then((rawResp) => {
        // API returns { patient: {...}, permissions: [...], ... }
        const d: any = (rawResp as any).patient ?? rawResp;
        setProfileRaw(d as Record<string, unknown>);
        const filled: FormState = {
          full_name:         (d.full_name      as string) ?? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim(),
          date_of_birth:     (d.date_of_birth  as string) ?? "",
          gender:            (d.gender         as string) ?? "",
          government_id:     (d.government_id  as string) ?? "",
          id_type:           (d.id_type        as string) ?? "",
          language_pref:     ((d.language_pref ?? d.primary_language) as string) ?? "",
          address_line1:     (d.address_line1  as string) ?? "",
          city:              (d.city           as string) ?? "",
          state:             (d.state          as string) ?? "",
          country:           (d.country        as string) ?? "",
          pincode:           (d.pincode        as string) ?? "",
          blood_group:       (d.blood_group    as string) ?? "",
          allergies:         (d.known_allergies as string) ?? "",
          emergency_contact: (d.emergency_contact as string) ?? "",
          occupation:        (d.occupation     as string) ?? "",
          marital_status:    (d.marital_status as string) ?? "",
          insurance_provider:(d.insurance_provider as string) ?? "",
          insurance_policy:  (d.policy_number  as string) ?? "",
          weight_kg:         (d.weight_kg      as string) ?? "",
          height_ft:         (d.height_ft      as string) ?? "",
          height_in:         (d.height_in      as string) ?? "",
        };
        setForm(filled);
        originalRef.current = filled;
      })
      .catch(() => setFetchError("Failed to load profile"));
  }, [dispatch]);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const diff = buildDiff(form, originalRef.current);
    if (!Object.keys(diff).length) { setIsEditing(false); return; }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const rawUpdated = await usersService.updateProfile(diff);
      const u: any = (rawUpdated as any).patient ?? rawUpdated;
      const freshFilled: FormState = {
        full_name:         (u.full_name      as string) ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
        date_of_birth:     (u.date_of_birth  as string) ?? "",
        gender:            (u.gender         as string) ?? "",
        government_id:     (u.government_id  as string) ?? "",
        id_type:           (u.id_type        as string) ?? "",
        language_pref:     ((u.language_pref ?? u.primary_language) as string) ?? "",
        address_line1:     (u.address_line1  as string) ?? "",
        city:              (u.city           as string) ?? "",
        state:             (u.state          as string) ?? "",
        country:           (u.country        as string) ?? "",
        pincode:           (u.pincode        as string) ?? "",
        blood_group:       (u.blood_group    as string) ?? "",
        allergies:         (u.known_allergies as string) ?? "",
        emergency_contact: (u.emergency_contact as string) ?? "",
        occupation:        (u.occupation     as string) ?? "",
        marital_status:    (u.marital_status as string) ?? "",
        insurance_provider:(u.insurance_provider as string) ?? "",
        insurance_policy:  (u.policy_number  as string) ?? "",
        weight_kg:         (u.weight_kg      as string) ?? "",
        height_ft:         (u.height_ft      as string) ?? "",
        height_in:         (u.height_in      as string) ?? "",
      };
      setForm(freshFilled);
      originalRef.current = freshFilled;
      setProfileRaw(u as Record<string, unknown>);
      dispatch(updateUserInStore({
        full_name:     u.full_name,
        first_name:    u.first_name,
        last_name:     u.last_name,
        city:          u.city,
        gender:        u.gender,
        date_of_birth: u.date_of_birth,
      }));
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => { setForm(originalRef.current); setSaveError(null); setIsEditing(false); };

  if (!profileRaw && !fetchError) return <PageLoader />;

  const age         = computeAge(form.date_of_birth);
  const mrn         = (profileRaw?.mrn as string) || "—";
  const status      = (profileRaw?.approval_status as string) || "active";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const email       = (profileRaw?.email as string) ?? "";
  const phone       = (profileRaw?.phone as string) ?? "";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── Header card ── */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-sky-50 via-blue-50/60 to-sky-50 p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight truncate">{form.full_name || "—"}</h1>
            
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-blue-100">
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Country</p>
            <p className="text-sm font-semibold text-neutral-800">{form.country || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Age</p>
            <p className="text-sm font-semibold text-neutral-800">{age ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Plan</p>
            <p className="text-sm font-semibold" style={{ color: BRAND_PRIMARY }}>Standard</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-semibold capitalize" style={{ color: BRAND_PRIMARY }}>{statusLabel}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex border-b border-neutral-100 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex-shrink-0 ${
                  active ? "text-neutral-900 border-sky-500" : "text-neutral-500 border-transparent hover:text-neutral-700"
                }`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Overview ── */}
        {activeTab === "overview" && (
          <div className="p-6">
            {fetchError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {fetchError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left — Personal Information */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-neutral-900">Personal Information</h2>
                  {!isEditing && (
                    <button
                      onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: BRAND }}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <FieldInput label="Full Name"     value={form.full_name}     onChange={(v) => set("full_name", v)} />
                    <FieldInput label="Date of Birth" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} type="date" />
                    <FieldInput label="Address"       value={form.address_line1} onChange={(v) => set("address_line1", v)} placeholder="Street address" />
                    <FieldInput label="Country"       value={form.country}       onChange={(v) => set("country", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput label="City"    value={form.city}    onChange={(v) => set("city", v)} />
                      <FieldInput label="State"   value={form.state}   onChange={(v) => set("state", v)} />
                    </div>
                    <FieldInput label="Pincode"   value={form.pincode}  onChange={(v) => set("pincode", v)} />
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                    <FieldInput label="Occupation"   value={form.occupation}   onChange={(v) => set("occupation", v)} />
                    <FieldInput label="Language"     value={form.language_pref} onChange={(v) => set("language_pref", v)} />

                    {saveError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ background: BRAND }}>
                        <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={handleCancel} disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                    {saveSuccess && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <InfoRow label="Full Name"    value={form.full_name} />
                    <InfoRow label="Email"        value={email} />
                    <InfoRow label="Phone"        value={phone} />
                    <InfoRow label="Date of Birth" value={form.date_of_birth} />
                    <InfoRow label="Gender"       value={form.gender} />
                    <InfoRow label="Address"      value={form.address_line1} />
                    <InfoRow label="City"         value={form.city} />
                    <InfoRow label="State"        value={form.state} />
                    <InfoRow label="Country"      value={form.country} />
                    <InfoRow label="Pincode"      value={form.pincode} />
                    <InfoRow label="Occupation"   value={form.occupation} />
                    <InfoRow label="Language"     value={form.language_pref} />
                  </div>
                )}
              </div>

              {/* Right — Medical Information + Care Team */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-neutral-900">Medical Information</h2>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <FieldInput label="Weight (KG)"        value={form.weight_kg}         onChange={(v) => set("weight_kg", v)}         placeholder="e.g., 72" />
                      <div>
                        <label className={labelCls}>Height</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input className={inputCls} value={form.height_ft} placeholder="Feet (e.g., 5)"   onChange={(e) => set("height_ft", e.target.value)} />
                          <input className={inputCls} value={form.height_in} placeholder="Inches (e.g., 10)" onChange={(e) => set("height_in", e.target.value)} />
                        </div>
                      </div>
                      <FieldInput label="Blood Group"        value={form.blood_group}        onChange={(v) => set("blood_group", v)}        placeholder="e.g., O+" />
                      <FieldInput label="Allergies"          value={form.allergies}          onChange={(v) => set("allergies", v)}          placeholder="e.g., Penicillin" />
                      <FieldInput label="Emergency Contact"  value={form.emergency_contact}  onChange={(v) => set("emergency_contact", v)}  placeholder="Name — Phone" />
                      <FieldInput label="Insurance Provider" value={form.insurance_provider} onChange={(v) => set("insurance_provider", v)} />
                      <FieldInput label="Policy Number"      value={form.insurance_policy}   onChange={(v) => set("insurance_policy", v)} />
                    </div>
                  ) : (
                    <div>
                      <InfoRow label="Weight (KG)"        value={form.weight_kg ? `${form.weight_kg} kg` : null} />
                      <InfoRow label="Height"             value={form.height_ft ? `${form.height_ft}′ ${form.height_in || "0"}″` : null} />
                      <InfoRow label="Blood Group"        value={form.blood_group} />
                      <InfoRow label="Allergies"          value={form.allergies} />
                      <InfoRow label="Emergency Contact"  value={form.emergency_contact} />
                      <InfoRow label="Insurance Provider" value={form.insurance_provider} />
                      <InfoRow label="Policy Number"      value={form.insurance_policy} />
                    </div>
                  )}
                </div>

                {/* Primary Care Team */}
                <div>
                  <h2 className="text-base font-bold text-neutral-900 mb-3">Primary Care Team</h2>
                  {myDoctor ? (
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-neutral-900">
                            Dr. {myDoctor.first_name} {myDoctor.last_name}
                          </p>
                          {myDoctor.specialization && (
                            <p className="text-xs text-neutral-500 mt-0.5">{myDoctor.specialization}</p>
                          )}
                          <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: BRAND_PRIMARY, background: "#EFF9FF" }}>
                            Primary
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400 text-center">
                      No doctor assigned yet
                    </div>
                  )}
                  <button className="mt-2 text-sm font-medium flex items-center gap-1" style={{ color: BRAND_PRIMARY }}>
                    <Plus className="w-3.5 h-3.5" /> Add Provider
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Purchases ── */}
        {activeTab === "purchases" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Purchase History</h2>
            <div className="rounded-xl border border-dashed border-neutral-200 py-14 text-center text-sm text-neutral-400">
              No purchase history available
            </div>
          </div>
        )}

        {/* ── Payments ── */}
        {activeTab === "payments" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Payment & Billing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border-l-4 border border-neutral-200 p-4" style={{ borderLeftColor: BRAND_PRIMARY }}>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Current Plan</p>
                <p className="text-lg font-bold text-neutral-900">Standard</p>
                <p className="text-xs text-neutral-500 mt-0.5">Clinical Assessment Platform</p>
              </div>
              <div className="rounded-xl border-l-4 border border-neutral-200 p-4" style={{ borderLeftColor: BRAND_PRIMARY }}>
                <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Balance</p>
                <p className="text-lg font-bold" style={{ color: BRAND_PRIMARY }}>—</p>
                <p className="text-xs text-neutral-500 mt-0.5">Contact your clinic for billing</p>
              </div>
            </div>
            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-4 px-4 py-3 bg-neutral-50 border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                <span>Date</span><span>Description</span><span>Amount</span><span>Status</span>
              </div>
              <div className="py-10 text-center text-sm text-neutral-400">No payment records</div>
            </div>
          </div>
        )}

        {/* ── Notifications ── */}
        {activeTab === "notifications" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Notification History</h2>
            <div className="rounded-xl border border-dashed border-neutral-200 py-14 text-center text-sm text-neutral-400">
              No notifications
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === "settings" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Preferences & Settings</h2>
            <div className="space-y-3">
              {([
                { key: "emailReminders", label: "Email Reminders",         desc: "Get appointment and health notifications" },
                { key: "weeklyReport",   label: "Weekly Report",           desc: "Receive health summaries every Monday"    },
                { key: "shareData",      label: "Share Data with Provider", desc: "Allow care team to access your metrics"  },
                { key: "darkMode",       label: "Dark Mode",               desc: "Enable dark theme (beta)"                },
              ] as const).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-neutral-200 hover:border-neutral-300 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => setSettings((prev) => ({ ...prev, [key]: !prev[key] }))}
                    className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                    style={settings[key]
                      ? { background: BRAND_PRIMARY, borderColor: BRAND_PRIMARY }
                      : { background: "#fff", borderColor: "#d1d5db" }}
                  >
                    {settings[key] && <Check className="w-3 h-3 text-white" />}
                  </button>
                </div>
              ))}
            </div>
            <button
              className="mt-5 w-full py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: BRAND }}
            >
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
