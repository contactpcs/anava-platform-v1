"use client";

import { useCallback, useEffect, useState } from "react";
import type { EEGReport } from "@/types/eeg.types";
import { eegService } from "@/lib/api/services/eeg.service";
import { EEGReportCard } from "./EEGReportCard";

interface Props {
  patientId: string;
  canDelete?: boolean;
  refreshTrigger?: number;
}

export function EEGReportList({ patientId, canDelete = false, refreshTrigger = 0 }: Props) {
  const [reports, setReports] = useState<EEGReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const limit = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await eegService.getPatientReports(patientId, skip, limit);
      setReports(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
    } catch {
      setError("Failed to load EEG reports.");
    } finally {
      setLoading(false);
    }
  }, [patientId, skip, refreshTrigger]);

  useEffect(() => { load(); }, [load]);

  function handleDeleted(id: string) {
    setReports((prev) => prev.filter((r) => r.id !== id));
    setTotal((t) => t - 1);
  }

  if (loading)
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-neutral-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );

  if (reports.length === 0)
    return (
      <div className="text-center py-10 text-neutral-400 text-sm">
        No EEG reports yet.
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">{total} report{total !== 1 ? "s" : ""} total</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {reports.map((r) => (
          <EEGReportCard key={r.id} report={r} canDelete={canDelete} onDeleted={handleDeleted} />
        ))}
      </div>
      {total > limit && (
        <div className="flex justify-center gap-3 pt-2">
          <button
            disabled={skip === 0}
            onClick={() => setSkip((s) => Math.max(0, s - limit))}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-neutral-500 self-center">
            {Math.floor(skip / limit) + 1} / {Math.ceil(total / limit)}
          </span>
          <button
            disabled={skip + limit >= total}
            onClick={() => setSkip((s) => s + limit)}
            className="px-3 py-1 text-sm border rounded-md disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
