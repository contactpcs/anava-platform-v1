"use client";

import { useEffect, useRef, useState } from "react";
import {
  User, DollarSign, Settings, Handshake,
  Edit2, Check, X, AlertCircle, CalendarDays, Users, Clock,
  Shield, KeyRound, Monitor, ClipboardCheck, TrendingUp,
} from "lucide-react";
import { PageLoader } from "@/components/ui";
import { usersService } from "@/lib/api/services/users.service";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateUserInStore } from "@/store/slices/authSlice";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { Appointment } from "@/types/domain.types";

// ─── types ────────────────────────────────────────────────────────

interface KpiStats {
  todayAppts: number;
  totalPatients: number;
  newPatients30d: number;
  pendingToday: number;
}

type TabId = "overview" | "finance" | "settings" | "partnership";

// ─── constants ────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["scheduled", "confirmed", "checked_in", "in_progress"]);
const BRAND    = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";
const BRAND_PX = "#00A1E4";

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",    Icon: User       },
  { id: "finance",      label: "Finance",     Icon: DollarSign },
  { id: "settings",     label: "Settings",    Icon: Settings   },
  { id: "partnership",  label: "Partnership", Icon: Handshake  },
];

// ─── helpers ──────────────────────────────────────────────────────

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function buildDiff(
  current: Record<string, string>,
  original: Record<string, string>,
): Record<string, string | number> {
  const diff: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== (original[k] ?? "")) diff[k] = k === "years_of_experience" ? Number(v) || 0 : v;
  }
  return diff;
}

const EMPTY_FORM = {
  first_name: "", last_name: "",
  date_of_birth: "", gender: "",
  government_id: "", id_type: "", language_pref: "",
  address_line1: "", city: "", state: "", country: "", pincode: "",
  specialisation: "", hospital: "", years_of_experience: "",
};
type FormState = typeof EMPTY_FORM;

const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:border-sky-400 hover:border-neutral-300 transition-all";
const labelCls = "text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 block";

// ─── component ────────────────────────────────────────────────────

export default function DoctorProfilePage() {
  const user     = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();

  const [profileRaw, setProfileRaw] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditing,  setIsEditing]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saveSuccess,setSaveSuccess]= useState(false);
  const [kpiStats,   setKpiStats]   = useState<KpiStats | null>(null);
  const [activeTab,  setActiveTab]  = useState<TabId>("overview");
  const [notifPrefs, setNotifPrefs] = useState({ newAppts: true, revenueUpdates: true, platformUpdates: false });

  const [form, setForm]   = useState<FormState>(EMPTY_FORM);
  const originalRef       = useRef<FormState>(EMPTY_FORM);

  // ── KPI fetch ────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = toDateStr(addDays(today, -30));
    Promise.all([
      apiClient.get(ENDPOINTS.APPOINTMENTS.TODAY).catch(() => ({ data: { data: [] } })),
      apiClient.get(ENDPOINTS.DOCTORS.DASHBOARD).catch(() => ({ data: { data: {} } })),
      apiClient.get(ENDPOINTS.DOCTORS.PATIENTS, { params: { limit: 100 } }).catch(() => ({ data: { data: [] } })),
    ]).then(([todayRes, dashRes, patientsRes]) => {
      const todayAppts: Appointment[] = todayRes.data?.data ?? [];
      const dashData = dashRes.data?.data ?? {};
      const patientsList: { created_at?: string }[] = patientsRes.data?.data ?? [];
      const totalPatients: number = dashData.patients_summary?.total ?? patientsList.length;
      const todayStr = toDateStr(today);
      const newPatients30d = patientsList.filter((p) => {
        if (!p.created_at) return false;
        const d = p.created_at.slice(0, 10);
        return d >= thirtyDaysAgo && d <= todayStr;
      }).length;
      setKpiStats({
        todayAppts: todayAppts.length,
        totalPatients,
        newPatients30d,
        pendingToday: todayAppts.filter((a) => ACTIVE_STATUSES.has(a.status)).length,
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── profile fetch ─────────────────────────────────────────────────
  useEffect(() => {
    usersService.getProfile()
      .then((data) => {
        setProfileRaw(data as unknown as Record<string, unknown>);
        const filled: FormState = {
          first_name:          (data.first_name        as string) ?? "",
          last_name:           (data.last_name         as string) ?? "",
          date_of_birth:       (data.date_of_birth     as string) ?? "",
          gender:              (data.gender            as string) ?? "",
          government_id:       (data.government_id     as string) ?? "",
          id_type:             (data.id_type           as string) ?? "",
          language_pref:       ((data.language_pref ?? data.primary_language) as string) ?? "",
          address_line1:       (data.address_line1     as string) ?? "",
          city:                (data.city              as string) ?? "",
          state:               (data.state             as string) ?? "",
          country:             (data.country           as string) ?? "",
          pincode:             (data.pincode           as string) ?? "",
          specialisation:      (data.specialisation    as string) ?? "",
          hospital:            (data.hospital          as string) ?? "",
          years_of_experience: String(data.years_of_experience ?? ""),
        };
        setForm(filled);
        originalRef.current = filled;
      })
      .catch(() => setFetchError("Failed to load profile"));
  }, []);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const diff = buildDiff(form, originalRef.current);
    if (!Object.keys(diff).length) { setIsEditing(false); return; }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const updated = await usersService.updateProfile(diff);
      const freshFilled: FormState = {
        first_name:          (updated.first_name        as string) ?? "",
        last_name:           (updated.last_name         as string) ?? "",
        date_of_birth:       (updated.date_of_birth     as string) ?? "",
        gender:              (updated.gender            as string) ?? "",
        government_id:       (updated.government_id     as string) ?? "",
        id_type:             (updated.id_type           as string) ?? "",
        language_pref:       ((updated.language_pref ?? updated.primary_language) as string) ?? "",
        address_line1:       (updated.address_line1     as string) ?? "",
        city:                (updated.city              as string) ?? "",
        state:               (updated.state             as string) ?? "",
        country:             (updated.country           as string) ?? "",
        pincode:             (updated.pincode           as string) ?? "",
        specialisation:      (updated.specialisation    as string) ?? "",
        hospital:            (updated.hospital          as string) ?? "",
        years_of_experience: String(updated.years_of_experience ?? ""),
      };
      setForm(freshFilled); originalRef.current = freshFilled;
      setProfileRaw(updated as unknown as Record<string, unknown>);
      dispatch(updateUserInStore({
        first_name: updated.first_name, last_name: updated.last_name,
        full_name: updated.full_name, specialisation: updated.specialisation,
        city: updated.city, gender: updated.gender, date_of_birth: updated.date_of_birth,
      }));
      setSaveSuccess(true); setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => { setForm(originalRef.current); setSaveError(null); setIsEditing(false); };

  if (!profileRaw && !fetchError) return <PageLoader />;

  const fullName = `Dr. ${form.first_name} ${form.last_name}`.trim().replace(/^Dr\. $/, "—");
  const email    = (profileRaw?.email as string) ?? "—";
  const phone    = (profileRaw?.phone as string) ?? "—";
  const mrn      = (profileRaw?.mrn as string) ?? (user?.id?.slice(0, 8).toUpperCase() ?? "—");
  const approvalStatus = (profileRaw?.approval_status as string) ?? "active";

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── Header card ── */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-sky-50 via-blue-50/40 to-sky-50 p-6 border-l-4" style={{ borderLeftColor: BRAND_PX }}>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight">{fullName}</h1>
            <p className="text-sm text-neutral-400 mt-0.5">ID: {mrn}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-blue-100">
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Specialization</p>
            <p className="text-sm font-semibold text-neutral-800">{form.specialisation || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Clinic</p>
            <p className="text-sm font-semibold" style={{ color: BRAND_PX }}>{form.hospital || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Country</p>
            <p className="text-sm font-semibold text-neutral-800">{form.country || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-semibold capitalize" style={{ color: BRAND_PX }}>{approvalStatus}</p>
          </div>
        </div>
      </div>

      {/* ── Tab panel ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-neutral-100 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex-shrink-0 ${
                  active ? "text-neutral-900 border-sky-500" : "text-neutral-500 border-transparent hover:text-neutral-700"
                }`}
              >
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
              {/* Left — Professional Information */}
              <div>
                <h2 className="text-base font-bold text-neutral-900 mb-4">Professional Information</h2>

                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>First Name</label>
                        <input className={inputCls} value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
                      </div>
                      <div>
                        <label className={labelCls}>Last Name</label>
                        <input className={inputCls} value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Specialisation</label>
                      <input className={inputCls} value={form.specialisation} placeholder="e.g. Psychiatry, Neurology…"
                        onChange={(e) => set("specialisation", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Hospital / Clinic</label>
                      <input className={inputCls} value={form.hospital} onChange={(e) => set("hospital", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Years of Experience</label>
                      <input type="number" min="0" max="60" className={inputCls} value={form.years_of_experience}
                        onChange={(e) => set("years_of_experience", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Country</label>
                      <input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} />
                    </div>
                    <div>
                      <label className={labelCls}>Language Preference</label>
                      <select className={inputCls} value={form.language_pref} onChange={(e) => set("language_pref", e.target.value)}>
                        <option value="">Select</option>
                        {["en","hi","te","ta","mr","kn","ml"].map((l) => (
                          <option key={l} value={l}>{l.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
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
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-0 divide-y divide-neutral-100">
                      {[
                        { label: "Full Name",           value: fullName },
                        { label: "Email",               value: email },
                        { label: "Phone",               value: phone },
                        { label: "Specialty",           value: form.specialisation },
                        { label: "Years of Experience", value: form.years_of_experience ? `${form.years_of_experience} years` : null },
                        { label: "Clinic / Practice",   value: form.hospital },
                        { label: "Country",             value: form.country },
                        { label: "Languages",           value: form.language_pref?.toUpperCase() },
                        { label: "Status",              value: approvalStatus, colored: true },
                      ].map(({ label, value, colored }) => (
                        <div key={label} className="flex items-center justify-between py-2.5 gap-4">
                          <span className="text-sm text-neutral-400 flex-shrink-0 w-36">{label}:</span>
                          <span className={`text-sm font-semibold text-right truncate ${colored ? "" : "text-neutral-900"}`}
                            style={colored ? { color: BRAND_PX } : {}}>
                            {value || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <button onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                        style={{ background: BRAND }}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit Profile
                      </button>
                      {saveSuccess && (
                        <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                          <Check className="w-4 h-4" /> Saved
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Right — Practice Statistics */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-base font-bold text-neutral-900 mb-3">Practice Statistics</h2>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Total Patients</p>
                        <p className="text-2xl font-bold" style={{ color: BRAND_PX }}>{kpiStats?.totalPatients ?? "—"}</p>
                      </div>
                      <Users className="w-8 h-8 text-blue-200" />
                    </div>
                    <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Today&apos;s Appointments</p>
                        <p className="text-2xl font-bold" style={{ color: BRAND_PX }}>{kpiStats?.todayAppts ?? "—"}</p>
                      </div>
                      <CalendarDays className="w-8 h-8 text-sky-200" />
                    </div>
                    <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Pending</p>
                        <p className="text-2xl font-bold text-neutral-700">{kpiStats?.pendingToday ?? "—"}</p>
                      </div>
                      <Clock className="w-8 h-8 text-neutral-200" />
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="text-base font-bold text-neutral-900 mb-3">Certifications &amp; Training</h2>
                  <div className="rounded-xl border border-dashed border-neutral-200 py-8 text-center text-sm text-neutral-400">
                    No certifications added yet
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Finance ── */}
        {activeTab === "finance" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Revenue &amp; Earnings</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Patients",  value: kpiStats?.totalPatients ?? "—", Icon: Users,         color: BRAND_PX },
                { label: "Today's Appts",   value: kpiStats?.todayAppts    ?? "—", Icon: CalendarDays,  color: BRAND_PX },
                { label: "New (30d)",       value: kpiStats?.newPatients30d ?? "—", Icon: TrendingUp,    color: BRAND_PX },
              ].map(({ label, value, Icon, color }) => (
                <div key={label} className="rounded-xl border border-neutral-200 p-4">
                  <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-2">{label}</p>
                  <p className="text-2xl font-bold" style={{ color }}>{value}</p>
                  <Icon className="w-4 h-4 mt-2 text-neutral-300" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-neutral-200 overflow-hidden mb-6">
              <div className="flex items-center justify-between px-5 py-4 bg-neutral-800">
                <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
                <span className="text-xs text-neutral-400">No records yet</span>
              </div>
              <div className="grid grid-cols-4 px-5 py-3 bg-neutral-50 border-b border-neutral-100 text-[11px] font-semibold text-neutral-400 uppercase tracking-wide">
                <span>Date</span><span>Patient</span><span>Service</span><span>Status</span>
              </div>
              <div className="py-10 text-center text-sm text-neutral-400">No transaction records</div>
            </div>
          </div>
        )}

        {/* ── Settings ── */}
        {activeTab === "settings" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-5">Account Settings</h2>

            <div className="space-y-5">
              {/* Notification Preferences */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-700">Notification Preferences</p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {([
                    { key: "newAppts",        label: "New Patient Appointments", desc: "Email notification for new bookings"     },
                    { key: "revenueUpdates",  label: "Revenue Updates",          desc: "Weekly revenue summaries"               },
                    { key: "platformUpdates", label: "Platform Updates",         desc: "New features and announcements"         },
                  ] as const).map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{label}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}
                        className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                        style={notifPrefs[key]
                          ? { background: BRAND_PX, borderColor: BRAND_PX }
                          : { background: "#fff", borderColor: "#d1d5db" }}
                      >
                        {notifPrefs[key] && <Check className="w-3 h-3 text-white" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Settings */}
              <div className="rounded-xl border border-neutral-200 overflow-hidden">
                <div className="px-5 py-3 bg-neutral-50 border-b border-neutral-100">
                  <p className="text-sm font-semibold text-neutral-700">Security Settings</p>
                </div>
                <div className="divide-y divide-neutral-100">
                  {[
                    { Icon: KeyRound, label: "Change Password",           sub: "Last changed: —"         },
                    { Icon: Shield,   label: "Two-Factor Authentication", sub: "Manage 2FA settings"     },
                    { Icon: Monitor,  label: "Active Sessions",           sub: "Manage logged-in devices" },
                  ].map(({ Icon, label, sub }) => (
                    <button key={label} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors text-left">
                      <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{label}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              className="mt-5 w-full py-3 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: BRAND }}
            >
              Save Settings
            </button>
          </div>
        )}

        {/* ── Partnership ── */}
        {activeTab === "partnership" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-3">Partnership</h2>
            <div className="rounded-xl border border-dashed border-neutral-200 py-16 flex flex-col items-center gap-2">
              <ClipboardCheck className="w-8 h-8 text-neutral-300" />
              <p className="text-sm text-neutral-400">Partnership details coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
