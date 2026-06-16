"use client";

import { useEffect, useState } from "react";
import {
  Building2, Plus, Search, Edit2, PowerOff, Power, X,
  MapPin, Phone, Mail, Users,
} from "lucide-react";
import { useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal } from "@/components/ui";
import type { AdminClinic, CreateClinicPayload } from "@/types/admin.types";

// ─── Skeleton ─────────────────────────────────────────────────────

function ClinicsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clinic Form ──────────────────────────────────────────────────

interface ClinicFormProps {
  initial?: Partial<AdminClinic>;
  onSubmit: (data: CreateClinicPayload) => Promise<unknown>;
  onClose: () => void;
  isEdit?: boolean;
}

function ClinicForm({ initial, onSubmit, onClose, isEdit }: ClinicFormProps) {
  const [form, setForm] = useState<CreateClinicPayload>({
    clinic_name: initial?.clinic_name ?? "",
    address: initial?.address ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    country: initial?.country ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof CreateClinicPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clinic_name.trim()) { setError("Clinic name is required"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save clinic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Name *</label>
        <Input
          value={form.clinic_name}
          onChange={(e) => set("clinic_name", e.target.value)}
          placeholder="e.g. Anava Mumbai"
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="City" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
          <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="State" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Full address" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="clinic@email.com" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
        <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} placeholder="India" />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Clinic" : "Create Clinic"}
        </Button>
      </div>
    </form>
  );
}

// ─── Clinic Card ──────────────────────────────────────────────────

interface ClinicCardProps {
  clinic: AdminClinic;
  onEdit: (clinic: AdminClinic) => void;
  onToggle: (clinic: AdminClinic) => void;
  toggling: boolean;
}

function ClinicCard({ clinic, onEdit, onToggle, toggling }: ClinicCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            clinic.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
          }`}>
            {clinic.is_active ? "Active" : "Inactive"}
          </span>
        </div>

        <h3 className="text-sm font-semibold text-neutral-900 leading-snug">{clinic.clinic_name}</h3>

        <div className="mt-2 space-y-1">
          {(clinic.city || clinic.state) && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{[clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {clinic.phone && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{clinic.phone}</span>
            </div>
          )}
          {clinic.email && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{clinic.email}</span>
            </div>
          )}
        </div>

        {(clinic.doctor_count !== undefined || clinic.patient_count !== undefined) && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-100">
            {clinic.doctor_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3.5 w-3.5" />
                <span>{clinic.doctor_count} doctors</span>
              </div>
            )}
            {clinic.patient_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3.5 w-3.5" />
                <span>{clinic.patient_count} patients</span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onEdit(clinic)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onToggle(clinic)}
            disabled={toggling}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors border ${
              clinic.is_active
                ? "text-red-600 hover:bg-red-50 border-red-200"
                : "text-green-600 hover:bg-green-50 border-green-200"
            }`}
          >
            {clinic.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {clinic.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminClinicsPage() {
  const { clinics, isLoading, error, fetch, createClinic, updateClinic, toggleClinic } = useAdminClinics();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editClinic, setEditClinic] = useState<AdminClinic | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { fetch(); }, [fetch]);

  const filtered = clinics.filter((c) => {
    const matchesSearch =
      c.clinic_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && c.is_active) ||
      (filter === "inactive" && !c.is_active);
    return matchesSearch && matchesFilter;
  });

  async function handleToggle(clinic: AdminClinic) {
    setTogglingId(clinic.clinic_id);
    setActionError(null);
    try {
      await toggleClinic(clinic.clinic_id, !clinic.is_active);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to update clinic status");
    } finally {
      setTogglingId(null);
    }
  }

  if (isLoading) return <ClinicsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clinics</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{clinics.length} clinic{clinics.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />New Clinic
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
            placeholder="Search clinics…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No clinics found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : "Add your first clinic to get started"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Add Clinic
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((clinic) => (
            <ClinicCard
              key={clinic.clinic_id}
              clinic={clinic}
              onEdit={setEditClinic}
              onToggle={handleToggle}
              toggling={togglingId === clinic.clinic_id}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Clinic">
        <ClinicForm onSubmit={createClinic} onClose={() => setShowCreate(false)} />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editClinic} onClose={() => setEditClinic(null)} title="Edit Clinic">
        {editClinic && (
          <ClinicForm
            initial={editClinic}
            isEdit
            onSubmit={(data) => updateClinic(editClinic.clinic_id, data)}
            onClose={() => setEditClinic(null)}
          />
        )}
      </Modal>
    </div>
  );
}
