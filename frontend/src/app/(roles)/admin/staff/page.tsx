"use client";

import { useEffect, useState } from "react";
import {
  UserCog, Plus, Search, Edit2, Power, PowerOff, Trash2,
  X, Mail, Building2,
} from "lucide-react";
import { useAdminStaff, useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal } from "@/components/ui";
import type { AdminStaffMember, RegisterStaffPayload } from "@/types/admin.types";

const ROLES = [
  { value: "doctor",             label: "Doctor" },
  { value: "receptionist",       label: "Receptionist" },
  { value: "clinical_assistant", label: "Clinical Assistant" },
  { value: "clinical_admin",     label: "Clinical Admin" },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  doctor:             { bg: "bg-blue-100",   text: "text-blue-700" },
  receptionist:       { bg: "bg-cyan-100",   text: "text-cyan-700" },
  clinical_assistant: { bg: "bg-teal-100",   text: "text-teal-700" },
  clinical_admin:     { bg: "bg-purple-100", text: "text-purple-700" },
  platform_admin:     { bg: "bg-rose-100",   text: "text-rose-700" },
};

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role.replace(/_/g, " ");
}

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? { bg: "bg-neutral-100", text: "text-neutral-600" };
}

// ─── Skeleton ─────────────────────────────────────────────────────

function StaffSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Register / Edit Form ─────────────────────────────────────────

interface StaffFormProps {
  initial?: Partial<AdminStaffMember>;
  clinicOptions: { value: string; label: string }[];
  onSubmit: (data: RegisterStaffPayload) => Promise<unknown>;
  onClose: () => void;
  isEdit?: boolean;
}

function StaffForm({ initial, clinicOptions, onSubmit, onClose, isEdit }: StaffFormProps) {
  const [form, setForm] = useState<RegisterStaffPayload>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? "doctor",
    clinic_id: initial?.clinic_id ?? "",
    phone: initial?.phone ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RegisterStaffPayload>(field: K, value: RegisterStaffPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim()) { setError("First name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!isEdit && !form.password.trim()) { setError("Password is required"); return; }
    if (!form.clinic_id) { setError("Please select a clinic"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save staff member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="First name" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name</label>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="staff@clinic.com" required />
      </div>
      {!isEdit && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Password *</label>
          <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Temporary password" required />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Role *</label>
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic *</label>
        <select
          value={form.clinic_id}
          onChange={(e) => set("clinic_id", e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
        >
          <option value="">Select clinic…</option>
          {clinicOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Staff" : "Register Staff"}
        </Button>
      </div>
    </form>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────

function ConfirmDeleteModal({ member, onConfirm, onClose }: {
  member: AdminStaffMember;
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
        Are you sure you want to permanently delete{" "}
        <strong>{member.first_name} {member.last_name}</strong>? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          type="button"
          variant="danger"
          disabled={loading}
          onClick={confirm}
        >
          {loading ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const { staff, isLoading, error, fetch, registerStaff, updateStaff, toggleStaff, deleteStaff } = useAdminStaff();
  const { clinics, fetch: fetchClinics } = useAdminClinics();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [showRegister, setShowRegister] = useState(false);
  const [editMember, setEditMember] = useState<AdminStaffMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<AdminStaffMember | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { fetch(); fetchClinics(); }, [fetch, fetchClinics]);

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));

  const filtered = staff.filter((s) => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesClinic = clinicFilter === "all" || s.clinic_id === clinicFilter;
    return matchesSearch && matchesRole && matchesClinic;
  });

  async function handleToggle(member: AdminStaffMember) {
    setTogglingId(member.id);
    setActionError(null);
    try {
      await toggleStaff(member.id, !member.is_active);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to update staff status");
    } finally {
      setTogglingId(null);
    }
  }

  const initials = (m: AdminStaffMember) =>
    [m.first_name?.[0], m.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading) return <StaffSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setShowRegister(true)} className="flex-shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />Register Staff
        </Button>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Clinics</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <UserCog className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No staff members found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : "Register your first staff member"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowRegister(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Register Staff
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Staff Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((member) => {
                  const rc = roleColor(member.role);
                  return (
                    <tr key={member.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs flex-shrink-0">
                            {initials(member)}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />{member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${rc.bg} ${rc.text}`}>
                          {roleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                          <Building2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="truncate max-w-[140px]">{member.clinic_name ?? member.clinic_id ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          member.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditMember(member)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(member)}
                            disabled={togglingId === member.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              member.is_active
                                ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                : "text-green-500 hover:text-green-700 hover:bg-green-50"
                            }`}
                            title={member.is_active ? "Deactivate" : "Reactivate"}
                          >
                            {member.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setDeleteMember(member)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Register modal */}
      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)} title="Register Staff Member">
        <StaffForm
          clinicOptions={clinicOptions}
          onSubmit={registerStaff}
          onClose={() => setShowRegister(false)}
        />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editMember} onClose={() => setEditMember(null)} title="Edit Staff Member">
        {editMember && (
          <StaffForm
            initial={editMember}
            isEdit
            clinicOptions={clinicOptions}
            onSubmit={(data) => updateStaff(editMember.id, data)}
            onClose={() => setEditMember(null)}
          />
        )}
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteMember} onClose={() => setDeleteMember(null)} title="Delete Staff Member">
        {deleteMember && (
          <ConfirmDeleteModal
            member={deleteMember}
            onConfirm={() => deleteStaff(deleteMember.id)}
            onClose={() => setDeleteMember(null)}
          />
        )}
      </Modal>
    </div>
  );
}
