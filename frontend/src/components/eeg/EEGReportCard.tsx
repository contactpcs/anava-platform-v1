"use client";

import { useState } from "react";
import type { EEGReport } from "@/types/eeg.types";
import { eegService } from "@/lib/api/services/eeg.service";
import { formatDate } from "@/lib/utils/format";

const STATUS_STYLES: Record<string, string> = {
  COMPLETED: "bg-green-100 text-green-800",
  PROCESSING: "bg-yellow-100 text-yellow-800",
  UPLOADING: "bg-blue-100 text-blue-800",
  FAILED: "bg-red-100 text-red-800",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  report: EEGReport;
  onDeleted?: (id: string) => void;
  canDelete?: boolean;
}

export function EEGReportCard({ report, onDeleted, canDelete = false }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this EEG report? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await eegService.deleteReport(report.id);
      onDeleted?.(report.id);
    } catch {
      alert("Failed to delete report.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-neutral-900 truncate">{report.report_name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            v{report.version} &middot; {report.report_type} &middot; {formatBytes(report.file_size_bytes)}
          </p>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
            STATUS_STYLES[report.status] ?? "bg-neutral-100 text-neutral-600"
          }`}
        >
          {report.status}
        </span>
      </div>

      <p className="text-xs text-neutral-400">{formatDate(report.created_at)}</p>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={async () => {
            setDownloading(true);
            try {
              await eegService.downloadReport(report.id, `${report.report_name}_v${report.version}.pdf`);
            } catch (err: any) {
              alert(err?.message ?? "Download failed.");
            } finally {
              setDownloading(false);
            }
          }}
          disabled={downloading}
          className="flex-1 text-center text-sm bg-blue-600 text-white rounded-md px-3 py-1.5 hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {downloading ? "Downloading…" : "Download PDF"}
        </button>
        {canDelete && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-600 hover:text-red-800 px-2 py-1.5 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}
