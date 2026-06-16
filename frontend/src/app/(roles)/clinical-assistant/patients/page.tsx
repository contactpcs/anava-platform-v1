"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input, Card, PageLoader } from "@/components/ui";
import { staffService } from "@/lib/api/services/staff.service";
import type { PatientListItem } from "@/types/domain.types";

export default function CAPatientsPage() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    staffService.getPatients().then(({ patients: p }) => {
      setPatients(p);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email} ${p.mrn || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <div className="divide-y divide-neutral-100">
          {filtered.map((p) => (
            <Link key={p.id} href={`/clinical-assistant/patients/${p.id}`} className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium text-sm">
                {p.first_name?.[0]}{p.last_name?.[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-neutral-900">{p.full_name || `${p.first_name} ${p.last_name}`}</p>
                <p className="text-xs text-neutral-500">{p.email}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-neutral-400">
                {p.mrn && <span>MRN: {p.mrn}</span>}
                {p.status && (
                  <span className={`px-2 py-0.5 rounded-full font-medium ${
                    p.status === "active" ? "bg-success-50 text-success-700" : "bg-neutral-100 text-neutral-500"
                  }`}>
                    {p.status}
                  </span>
                )}
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="px-6 py-8 text-center text-neutral-500 text-sm">No patients found</div>
          )}
        </div>
      </Card>
    </div>
  );
}
