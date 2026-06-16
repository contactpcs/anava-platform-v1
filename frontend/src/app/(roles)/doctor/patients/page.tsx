"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input, PatientListSkeleton } from "@/components/ui";
import { useDoctorPatients } from "@/lib/hooks";

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtGender(g?: string): string {
  if (!g) return "";
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

export default function DoctorPatientsPage() {
  const { patients, isLoading } = useDoctorPatients();
  const [search, setSearch] = useState("");
  const router = useRouter();

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email} ${p.mrn || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PatientListSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Patients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Search by name or MRN</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="e.g., Alice or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Patient Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Last Visit</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((p) => {
              const age = calcAge(p.date_of_birth);
              const lastVisit = p.last_prs?.completed_at ?? p.assigned_at ?? null;
              const clinicLabel = p.clinic_name ?? p.clinic_city ?? "Kharadi, Pune";
              return (
                <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                  {/* Patient Name */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}>
                        {p.first_name?.[0]}{p.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{p.full_name || `${p.first_name} ${p.last_name}`}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {age !== null && <span className="text-xs text-neutral-400">{age} yrs</span>}
                          {age !== null && p.gender && <span className="text-neutral-300 text-xs">·</span>}
                          {p.gender && <span className="text-xs text-neutral-400">{fmtGender(p.gender)}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* Clinic Name */}
                  <td className="px-6 py-4 text-neutral-600">{clinicLabel}</td>
                  {/* Last Visit */}
                  <td className="px-6 py-4 text-neutral-600">{fmtDate(lastVisit)}</td>
                  {/* Status */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                      p.status === "active" || !p.status
                        ? "bg-green-50 text-green-700"
                        : "bg-neutral-100 text-neutral-500"
                    }`}>
                      {p.status ? (p.status.charAt(0).toUpperCase() + p.status.slice(1)) : "Active"}
                    </span>
                  </td>
                  {/* Action */}
                  <td className="px-6 py-4">
                    <button
                      onClick={() => router.push(`/doctor/patients/${p.id}`)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                      style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-neutral-400 text-sm">No patients found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
