"use client";

import { useRef, useState } from "react";
import { eegService } from "@/lib/api/services/eeg.service";

const MAX_MB = 20;
const MAX_BYTES = MAX_MB * 1024 * 1024;

interface Props {
  patientId: string;
  sessionId?: string;
  onUploaded?: () => void;
}

export function EEGUploadForm({ patientId, sessionId, onUploaded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reportName, setReportName] = useState("");
  const [reportType, setReportType] = useState("EEG_ANALYSIS");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a PDF file."); return; }
    if (file.size > MAX_BYTES) { setError(`File exceeds ${MAX_MB} MB limit.`); return; }
    if (!file.name.toLowerCase().endsWith(".pdf")) { setError("Only .pdf files accepted."); return; }
    if (!reportName.trim()) { setError("Enter a report name."); return; }

    setUploading(true);
    try {
      await eegService.uploadReport({
        file,
        patient_id: patientId,
        session_id: sessionId,
        report_name: reportName.trim(),
        report_type: reportType,
      });
      setSuccess(true);
      setReportName("");
      if (fileRef.current) fileRef.current.value = "";
      onUploaded?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (detail?.message) {
        setError(detail.message);
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Upload failed. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-neutral-200 rounded-lg p-5">
      <h3 className="font-semibold text-neutral-900">Upload EEG Report</h3>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          PDF File <span className="text-neutral-400 font-normal">(max {MAX_MB} MB)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          required
          className="block w-full text-sm text-neutral-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Report Name</label>
        <input
          type="text"
          value={reportName}
          onChange={(e) => setReportName(e.target.value)}
          placeholder="e.g. EEG Analysis — 2026-06-04"
          required
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Report Type</label>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="EEG_ANALYSIS">EEG Analysis</option>
          <option value="BRAIN_CONNECTIVITY">Brain Connectivity</option>
          <option value="BRAIN_INDICATORS">Brain Indicators</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Report uploaded successfully.</p>}

      <button
        type="submit"
        disabled={uploading}
        className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {uploading ? "Uploading…" : "Upload Report"}
      </button>
    </form>
  );
}
