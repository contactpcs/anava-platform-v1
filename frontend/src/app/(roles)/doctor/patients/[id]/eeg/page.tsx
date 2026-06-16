"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EEGReportList, EEGUploadForm } from "@/components/eeg";

export default function DoctorPatientEEGPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  function handleUploaded() {
    setRefreshKey((k) => k + 1);
    setShowUpload(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/doctor/patients/${patientId}`}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back to patient
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">EEG Reports</h1>
          <p className="text-sm text-neutral-500">Brain mapping and analysis reports</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showUpload ? "Cancel" : "Upload Report"}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <EEGUploadForm
          patientId={patientId}
          onUploaded={handleUploaded}
        />
      )}

      {/* Report list */}
      <EEGReportList
        patientId={patientId}
        canDelete={true}
        refreshTrigger={refreshKey}
      />
    </div>
  );
}
