"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, HelpCircle, Bell, Check, Lock, PlayCircle, BarChart2, Save } from "lucide-react";
import { PatientDetailSkeleton, Button } from "@/components/ui";
import { AnamnesisForm } from "@/components/assessment/AnamnesisForm";
import {
  useDoctorPatient,
  useDoctorPatients,
  usePatientPermissions,
  usePatientScoresSummary,
  usePatientAnamnesis,
  usePatientNote,
} from "@/lib/hooks";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientAnamnesis } from "@/store/slices/anamnesisSlice";
import type { DoctorNote } from "@/lib/api/services/doctorNotes.service";
import type { Permission, AssessmentInstance, AnamnesisRecord } from "@/types/domain.types";
import { EEGReportList, EEGUploadForm, NEDFUploadForm } from "@/components/eeg";

function statusClass(status: Permission["status"]): string {
  switch (status) {
    case "granted": return "bg-blue-50 text-blue-700";
    case "completed": return "bg-green-50 text-green-700";
    case "expired": return "bg-yellow-50 text-yellow-700";
    case "revoked": return "bg-red-50 text-red-700";
    default: return "bg-neutral-100 text-neutral-600";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildSections(
  anamnesisStatus: "in_progress" | "completed" | null,
  hasDoctorNote: boolean,
) {
  return [
    { id: "anamnesis", name: "Anamnesis", status: anamnesisStatus === "completed" ? "done" : anamnesisStatus === "in_progress" ? "start" : null },
    { id: "brain-mapping", name: "Brain Mapping", status: "start" },
    { id: "prs", name: "PRS", status: "start" },
    { id: "notes", name: "Doctor's Notes", status: hasDoctorNote ? "done" : null },
    { id: "medical-history", name: "Medical History", status: "link" },
    { id: "treatment-plan", name: "Treatment Plan", status: "locked" },
    { id: "final-report", name: "Final Report", status: "locked" },
  ];
}

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dispatch = useAppDispatch();
  const patient = useDoctorPatient(id);
  const { patients: patientList } = useDoctorPatients();
  const assessments = usePatientPermissions(id);
  const { instances: scoreInstances, total: totalAssessments } = usePatientScoresSummary(id);
  const { record: anamnesisRecord, isLoading: anamnesisLoading } = usePatientAnamnesis(id);
  const { note: doctorNote, isLoading: noteLoading, save: saveNote } = usePatientNote(id);

  const isLoading = !patient;

  const selectedSection = searchParams.get("section") ?? "anamnesis";
  const tabParam = parseInt(searchParams.get("tab") ?? "0", 10);
  const selectedAssessmentTab = Number.isFinite(tabParam) && tabParam >= 0 ? tabParam : 0;

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setSelectedSection = useCallback(
    (s: string) => updateQuery({ section: s === "anamnesis" ? null : s }),
    [updateQuery],
  );
  const setSelectedAssessmentTab = useCallback(
    (idx: number) => updateQuery({ tab: idx === 0 ? null : String(idx) }),
    [updateQuery],
  );
  const [basicOpen, setBasicOpen] = useState(true);
  const [eegRefreshKey, setEegRefreshKey] = useState(0);
  const [showEegUpload, setShowEegUpload] = useState(false);
  const [eegUploadTab, setEegUploadTab] = useState<"nedf" | "pdf">("nedf");
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSavedAt, setNoteSavedAt] = useState<string | null>(null);

  useEffect(() => {
    if (doctorNote) {
      setNoteText(doctorNote.note_text ?? "");
      setNoteSavedAt(doctorNote.updated_at ?? null);
    }
  }, [doctorNote]);

  // Auto-expand upload panel when user returns to brain-mapping and a job is still running
  useEffect(() => {
    if (selectedSection !== "brain-mapping") return;
    const saved = localStorage.getItem(`eeg_analysis_job_${id}`);
    if (!saved) return;
    try {
      const { status } = JSON.parse(saved) as { status: string };
      if (status !== "done" && status !== "failed") {
        setShowEegUpload(true);
        setEegUploadTab("nedf");
      }
    } catch {}
  }, [selectedSection, id]);

  const handleSaveNote = async () => {
    setNoteSaving(true);
    setNoteError(null);
    try {
      const result = await saveNote(noteText);
      const saved = (result as any)?.payload?.note as DoctorNote | undefined;
      if (saved?.note_text != null) setNoteText(saved.note_text);
      setNoteSavedAt(saved?.updated_at ?? new Date().toISOString());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save note";
      setNoteError(message);
    } finally {
      setNoteSaving(false);
    }
  };

  if (isLoading) return <PatientDetailSkeleton />;

  const fullName = patient?.full_name || "Patient";
  const currentIdx = patientList.findIndex((p) => p.id === id);
  const prevPatient = currentIdx > 0 ? patientList[currentIdx - 1] : null;
  const nextPatient = currentIdx >= 0 && currentIdx < patientList.length - 1 ? patientList[currentIdx + 1] : null;

  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  const nextAssessment = (assessments as Permission[]).find((a: Permission) => a.status === "granted");
  const completedAssessments = (assessments as Permission[]).filter((a: Permission) => a.status === "completed");
  const pendingAssessments = (assessments as Permission[]).filter((a: Permission) => a.status === "granted");

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-50">
      {/* Top Header with Navigation */}
      <div className="bg-white border-b border-neutral-200 px-4 sm:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/doctor/patients")}
            className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900 transition-colors text-sm font-medium flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5 -scale-x-100" />
            <span className="hidden sm:inline">Back to search</span>
          </button>
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="relative flex-1 max-w-xs bg-white border border-neutral-200 rounded-full flex items-center px-4 py-2 shadow-sm hidden sm:flex">
              <input
                type="text"
                placeholder="Search patients..."
                className="flex-1 bg-transparent outline-none text-sm text-neutral-600 placeholder:text-neutral-400"
              />
            </div>
            <button className="w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200 flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-neutral-600" />
            </button>
            <button className="relative w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200 flex-shrink-0">
              <Bell className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
        {/* Patient info + Next Activity — two side-by-side cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* Left — Patient Name Card */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920] flex-shrink-0">
                {fullName?.[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
                {patient?.mrn && (
                  <p className="text-sm text-neutral-600">({patient.mrn})</p>
                )}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {age && (
                    <span className="text-base text-neutral-700">
                      {age} Yrs{patient?.gender ? ` · ${patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}` : ""}
                    </span>
                  )}
                  {patient?.approval_status && (
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg capitalize">
                      {patient.approval_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => prevPatient && router.push(`/doctor/patients/${prevPatient.id}`)}
                disabled={!prevPatient}
                className="px-3 py-1.5 bg-neutral-800 text-white text-xs font-medium rounded-full hover:bg-neutral-700 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                title={prevPatient?.full_name ?? ""}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <button
                onClick={() => nextPatient && router.push(`/doctor/patients/${nextPatient.id}`)}
                disabled={!nextPatient}
                className="px-3 py-1.5 bg-neutral-800 text-white text-xs font-medium rounded-full hover:bg-neutral-700 transition-colors flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                title={nextPatient?.full_name ?? ""}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right — Next Activity Card */}
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {nextAssessment ? (
              <>
                <div>
                  <p className="text-neutral-500 text-sm mb-1">Next Activity</p>
                  <h3 className="text-2xl font-bold text-neutral-900">{nextAssessment.disease_name}</h3>
                  <span className="inline-block mt-2 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">Basic 2/7</span>
                </div>
                <button 
                  onClick={() => router.push(`/doctor/patients/${id}/assessment/${nextAssessment.permission_id}`)}
                  className="px-6 py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors flex items-center gap-2 flex-shrink-0"
                >
                  ▶ Start
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-4 text-center">
                <p className="text-neutral-500 text-sm">No pending activity</p>
                <p className="text-neutral-400 text-xs mt-1">Assign an assessment to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Assessment Tabs and Content */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 scrollbar-none">
            <div className="px-4 py-2 bg-neutral-900 text-white font-medium rounded-lg text-sm">
              Today's Activity
            </div>
            {assessments.slice(0, 2).map((a, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAssessmentTab(idx)}
                className={`px-4 py-2 font-medium rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  selectedAssessmentTab === idx
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {a.disease_name}
                {a.status === "completed" && <Check className="w-4 h-4" />}
              </button>
            ))}
            <button className="px-3 py-2 border border-neutral-300 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-96">
            {/* Left Sidebar - Assessment Sections */}
            <div className="w-full lg:w-72 xl:w-80 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
              <button
                onClick={() => setBasicOpen((o) => !o)}
                className="border-b border-neutral-200 p-4 flex items-center justify-between w-full text-left hover:bg-neutral-50 transition-colors"
              >
                <h3 className="font-semibold text-neutral-900">Basic</h3>
                <ChevronRight className={`w-5 h-5 text-neutral-600 transition-transform duration-150 ${basicOpen ? "-rotate-90" : "rotate-0"}`} />
              </button>
              <div className={`overflow-y-auto space-y-0 transition-all duration-150 ${basicOpen ? "flex-1" : "hidden"}`}>
                {buildSections(anamnesisRecord?.status ?? null, !!doctorNote?.note_text).map((section) => {
                  if (section.id === "medical-history") {
                    return (
                      <Link
                        key="medical-history"
                        href={`/doctor/patients/${id}/history`}
                        className="w-full px-4 py-4 text-left transition-colors border-l-4 flex items-center justify-between bg-white border-l-transparent text-neutral-700 hover:bg-neutral-50"
                      >
                        <span className="font-medium">{section.name}</span>
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={section.id}
                      onClick={() => setSelectedSection(section.id)}
                      className={`w-full px-4 py-4 text-left transition-colors border-l-4 flex items-center justify-between ${
                        selectedSection === section.id
                          ? "bg-blue-50 border-l-blue-500 text-blue-700"
                          : "bg-white border-l-transparent text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <span className="font-medium">{section.name}</span>
                      {section.status === "done" && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">Done</span>
                      )}
                      {section.status === "start" && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded">Start</span>
                      )}
                      {section.status === "locked" && (
                        <Lock className="w-4 h-4 text-neutral-400" />
                      )}
                    </button>
                  );
                })}
              </div>
             
            </div>

            {/* Right Content - Assessment Details */}
            <div className="flex-1 bg-white rounded-lg shadow-md p-4 sm:p-8 overflow-y-auto">
              {selectedSection === "anamnesis" ? (
                <AnamnesisForm
                  patientId={id}
                  mode="doctor"
                  initialRecord={anamnesisRecord}
                  onSubmitted={() => dispatch(invalidatePatientAnamnesis(id))}
                />
              ) : selectedSection === "brain-mapping" ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900">Brain Mapping</h2>
                      <p className="text-sm text-neutral-500">EEG analysis and connectivity reports</p>
                    </div>
                    <button
                      onClick={() => setShowEegUpload((v) => !v)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      {showEegUpload ? "Cancel" : "Upload / Analyze"}
                    </button>
                  </div>

                  {showEegUpload && (
                    <div className="space-y-3">
                      {/* Tab switcher */}
                      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
                        <button
                          onClick={() => setEegUploadTab("nedf")}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            eegUploadTab === "nedf"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                        >
                          .nedf / .edf
                        </button>
                        <button
                          onClick={() => setEegUploadTab("pdf")}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            eegUploadTab === "pdf"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                        >
                          PDF report
                        </button>
                      </div>

                      {eegUploadTab === "nedf" ? (
                        <NEDFUploadForm
                          patientId={id}
                          onComplete={() => { setEegRefreshKey((k) => k + 1); setShowEegUpload(false); }}
                        />
                      ) : (
                        <EEGUploadForm
                          patientId={id}
                          onUploaded={() => { setEegRefreshKey((k) => k + 1); setShowEegUpload(false); }}
                        />
                      )}
                    </div>
                  )}

                  <EEGReportList patientId={id} canDelete refreshTrigger={eegRefreshKey} />
                </div>
              ) : selectedSection === "notes" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-1">Doctor's Notes</h2>
                      <p className="text-neutral-600 text-sm">
                        Private notes for {fullName}. Only you can view and edit these.
                      </p>
                    </div>
                    {noteSavedAt && (
                      <span className="text-xs text-neutral-500 mt-2">
                        Last saved {formatDate(noteSavedAt)}
                      </span>
                    )}
                  </div>

                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Type your clinical notes here..."
                    className="w-full min-h-[320px] resize-y border border-neutral-200 rounded-lg p-4 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors"
                  />

                  {noteError && (
                    <p className="text-sm text-red-600">{noteError}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-neutral-500">
                      {noteText.length} character{noteText.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setNoteText(doctorNote?.note_text ?? "")}
                        disabled={noteSaving || noteText === (doctorNote?.note_text ?? "")}
                        className="px-4 py-2 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reset
                      </button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveNote}
                        disabled={noteSaving || noteText === (doctorNote?.note_text ?? "")}
                      >
                        <Save className="h-4 w-4" />
                        {noteSaving ? "Saving..." : "Save Note"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                // PRS View - Show Completed Assessments
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-1">PRS Assessments</h2>
                      <p className="text-neutral-600 text-sm">Completed assessments and assignment options</p>
                    </div>
                    <Link href={`/doctor/patients/${id}/assign`}>
                      <Button size="sm" variant="primary">
                        <Plus className="h-4 w-4" /> Assign New Assessment
                      </Button>
                    </Link>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Total Assessments</p>
                      <p className="text-2xl font-bold text-neutral-900">{totalAssessments || assessments.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Completed</p>
                      <p className="text-2xl font-bold text-neutral-900">{completedAssessments.length}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Pending</p>
                      <p className="text-2xl font-bold text-neutral-900">{pendingAssessments.length}</p>
                    </div>
                  </div>

                  {/* Completed Assessments */}
                  {completedAssessments.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-neutral-900">Completed</h3>
                      {completedAssessments.map(a => {
                        const result = scoreInstances.find(
                          s => s.instance_id === a.instance_id || s.disease_id === a.disease_id
                        );
                        return (
                          <div key={a.permission_id} className="border border-neutral-200 rounded-lg p-4 space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-neutral-900">{a.disease_name}</h4>
                                <p className="text-sm text-neutral-600 mt-1">
                                  Completed on {formatDate(result?.completed_at ?? a.granted_at)}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                                <Check className="w-3 h-3" /> Completed
                              </span>
                            </div>

                            {/* Score results */}
                            {result && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {result.disease_score != null && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Overall Score</p>
                                    <p className="text-xl font-bold text-neutral-900">
                                      {result.disease_score.toFixed(0)}
                                      <span className="text-sm font-normal text-neutral-400"> /100</span>
                                    </p>
                                  </div>
                                )}
                                {result.severity_label && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Severity</p>
                                    <p className={`text-sm font-semibold ${
                                      result.severity_level === "severe" ? "text-red-700" :
                                      result.severity_level === "moderate" ? "text-orange-700" :
                                      result.severity_level === "mild" ? "text-yellow-700" :
                                      "text-green-700"
                                    }`}>{result.severity_label}</p>
                                  </div>
                                )}
                                {result.percentage != null && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Percentage</p>
                                    <p className="text-xl font-bold text-neutral-900">
                                      {result.percentage.toFixed(0)}%
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Scale summaries */}
                            {result?.scale_summaries && result.scale_summaries.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Scale Results</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {result.scale_summaries.map((scale, i) => (
                                    <div key={scale.scale_id ?? i} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                                      <span className="text-sm text-neutral-700">{scale.scale_name ?? scale.scale_code}</span>
                                      <div className="flex items-center gap-2">
                                        {scale.calculated_value != null && (
                                          <span className="text-sm font-semibold text-neutral-900">
                                            {scale.calculated_value}
                                            {scale.max_possible != null && <span className="text-xs font-normal text-neutral-400">/{scale.max_possible}</span>}
                                          </span>
                                        )}
                                        {scale.severity_label && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            scale.severity_level === "severe" ? "bg-red-50 text-red-700" :
                                            scale.severity_level === "moderate" ? "bg-orange-50 text-orange-700" :
                                            scale.severity_level === "mild" ? "bg-yellow-50 text-yellow-700" :
                                            "bg-green-50 text-green-700"
                                          }`}>{scale.severity_label}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              {a.instance_id ? (
                                <Link href={`/doctor/patients/${id}/results?instance_id=${a.instance_id}`}>
                                  <button className="px-5 py-2 border border-neutral-400 text-neutral-900 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4" /> View Detailed Report
                                  </button>
                                </Link>
                              ) : (
                                <button className="px-5 py-2 border border-neutral-400 text-neutral-900 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm flex items-center gap-2">
                                  <BarChart2 className="w-4 h-4" /> View Detailed Report
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-200 rounded-lg">
                      <p className="text-neutral-600 font-medium mb-2">No completed PRS assessments yet</p>
                      <p className="text-neutral-500 text-sm">Assign an assessment to get started</p>
                    </div>
                  )}

                  {/* Pending Assessments */}
                  {pendingAssessments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-neutral-900">Pending</h3>
                      {pendingAssessments.map(a => (
                        <div key={a.permission_id} className="border border-neutral-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-neutral-900">{a.disease_name}</h4>
                              <p className="text-sm text-neutral-600 mt-1">Assigned on {formatDate(a.granted_at)}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                              Pending
                            </span>
                          </div>
                          <Link href={`/doctor/patients/${id}/assessment/${a.permission_id}`}>
                            <Button size="sm" variant="secondary">
                              <PlayCircle className="h-4 w-4" /> Start Assessment
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
