"use client";

import { useEffect, useRef, useState } from "react";
import { eegAnalysisService, type AnalysisJob } from "@/lib/api/services/eegAnalysis.service";

const POLL_MS = 4000;
const ALLOWED_EXT = [".nedf", ".edf"];

interface Props {
  patientId: string;
  sessionId?: string;
  onComplete?: () => void;
}

type Phase = "idle" | "uploading" | "polling" | "done" | "failed";

function jobKey(patientId: string) {
  return `eeg_analysis_job_${patientId}`;
}

function readSavedJob(patientId: string): { id: string; phase: Phase } | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(jobKey(patientId));
  if (!raw) return null;
  try {
    const { id, status } = JSON.parse(raw) as { id: string; status: string };
    if (status === "done" || status === "failed") {
      localStorage.removeItem(jobKey(patientId));
      return null;
    }
    return { id, phase: "polling" };
  } catch {
    return null;
  }
}

export function NEDFUploadForm({ patientId, sessionId, onComplete }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const [reportName, setReportName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);

  // Lazy init: start in correct phase immediately — no useEffect flash
  const [phase, setPhase] = useState<Phase>(() => {
    const saved = readSavedJob(patientId);
    return saved?.phase ?? "idle";
  });
  const [jobId, setJobId] = useState<string | null>(() => {
    const saved = readSavedJob(patientId);
    return saved?.id ?? null;
  });

  // Poll until done or failed
  useEffect(() => {
    if (phase !== "polling" || !jobId) return;
    let active = true;

    const tick = async () => {
      try {
        const status = await eegAnalysisService.getStatus(jobId);
        if (!active) return;
        setJob(status);
        localStorage.setItem(jobKey(patientId), JSON.stringify({ id: jobId, status: status.status }));
        if (status.status === "done") {
          setPhase("done");
          localStorage.removeItem(jobKey(patientId));
          onCompleteRef.current?.();
        } else if (status.status === "failed") {
          setPhase("failed");
          setError(status.error ?? "Analysis failed.");
          localStorage.removeItem(jobKey(patientId));
        } else {
          setTimeout(tick, POLL_MS);
        }
      } catch (e: any) {
        if (!active) return;
        setError(e.message ?? "Polling error.");
        setPhase("failed");
        localStorage.removeItem(jobKey(patientId));
      }
    };

    tick();
    return () => { active = false; };
  }, [phase, jobId, patientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0];
    if (!file) { setError("Select a .nedf or .edf file."); return; }

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError("Only .nedf and .edf files accepted.");
      return;
    }
    if (!reportName.trim()) { setError("Enter a report name."); return; }

    setPhase("uploading");
    try {
      const id = await eegAnalysisService.submitAnalysis({
        file,
        patient_id: patientId,
        session_id: sessionId,
        report_name: reportName.trim(),
      });
      localStorage.setItem(jobKey(patientId), JSON.stringify({ id, status: "queued" }));
      setJobId(id);
      setPhase("polling");
    } catch (err: any) {
      setError(err.message ?? "Upload failed.");
      setPhase("failed");
    }
  }

  function reset() {
    setPhase("idle");
    setJob(null);
    setJobId(null);
    setError(null);
    setReportName("");
    localStorage.removeItem(jobKey(patientId));
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── Polling / result view ────────────────────────────────────────────────
  if (phase === "polling" || phase === "done" || phase === "failed") {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">EEG Analysis</h3>
          {(phase === "done" || phase === "failed") && (
            <button onClick={reset} className="text-sm text-blue-600 hover:underline">
              New upload
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {phase === "polling" && (
            <span className="inline-flex items-center gap-2 text-sm text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              Running — safe to navigate away, analysis continues in background
            </span>
          )}
          {phase === "done" && (
            <span className="text-sm text-green-700 bg-green-50 px-3 py-1 rounded-full">
              Complete
            </span>
          )}
          {phase === "failed" && (
            <span className="text-sm text-red-700 bg-red-50 px-3 py-1 rounded-full">
              Failed
            </span>
          )}
          {job?.step && (
            <span className="text-sm text-neutral-600">{job.step}</span>
          )}
        </div>

        {phase === "polling" && (
          <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-2/3" />
          </div>
        )}

        {job?.warnings && job.warnings.length > 0 && (
          <div className="text-xs text-yellow-700 bg-yellow-50 rounded p-3 space-y-1">
            {job.warnings.map((w, i) => <p key={i}>{w}</p>)}
          </div>
        )}

        {phase === "done" && job?.outputs && job.outputs.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
              Generated reports saved to backend
            </p>
            {job.outputs.map((f, i) => (
              <p key={i} className="text-sm text-neutral-700 font-mono truncate">{f}</p>
            ))}
          </div>
        )}

        {error && (
          <pre className="text-xs text-red-700 bg-red-50 rounded p-3 whitespace-pre-wrap overflow-auto max-h-40">
            {error}
          </pre>
        )}
      </div>
    );
  }

  // ── Upload form ──────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-lg p-5 space-y-4">
      <h3 className="font-semibold text-neutral-900">Run EEG Analysis</h3>
      <p className="text-xs text-neutral-500">
        Upload a raw EEG recording. The pipeline generates PDF reports and saves them automatically.
      </p>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">
          EEG File <span className="text-neutral-400 font-normal">(.nedf or .edf)</span>
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".nedf,.edf"
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
          placeholder="e.g. EEG Session 2026-06-04"
          required
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={phase === "uploading"}
        className="w-full bg-blue-600 text-white rounded-md py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {phase === "uploading" ? "Uploading…" : "Start Analysis"}
      </button>
    </form>
  );
}
