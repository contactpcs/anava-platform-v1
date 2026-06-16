"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessions } from "@/lib/hooks";
import { doctorsService } from "@/lib/api/services";
import { Button, Input, Card, CardContent, PageLoader } from "@/components/ui";
import { ConditionSelector } from "@/components/assessment";
import { Clock, ChevronLeft } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientPermissions, fetchPatientPermissions } from "@/store/slices/permissionsSlice";
import { invalidateDoctorPatients, fetchDoctorPatients, fetchDoctorPatient } from "@/store/slices/doctorsSlice";

export default function AssignAssessmentPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { conditions, currentCondition, loadConditions, loadConditionDetail, resetConditionDetail } = useSessions();
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [mode, setMode] = useState<"self" | "clinician_administered" | "voice">("self");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadConditions(); }, [loadConditions]);

  const handleSelectCondition = (conditionId: string) => {
    setSelectedCondition(conditionId); // composite id used for session creation
    // use UUID (id field) for the detail API path to avoid slashes in composite condition_ids
    const cond = safeConditions.find((c) => c.condition_id === conditionId);
    loadConditionDetail(cond?.id ?? conditionId);
  };

  useEffect(() => {
    return () => { resetConditionDetail(); };
  }, [resetConditionDetail]);

  const safeConditions = Array.isArray(conditions) ? conditions : [];
  if (safeConditions.length === 0) return <PageLoader />;

  const handleAssign = async () => {
    if (!selectedCondition) return;
    setIsSubmitting(true);
    try {
      await doctorsService.grantAssessment(patientId, {
        disease_id: selectedCondition,
      });
      dispatch(invalidatePatientPermissions(patientId));
      dispatch(invalidateDoctorPatients());
      await Promise.all([
        dispatch(fetchPatientPermissions(patientId)),
        dispatch(fetchDoctorPatient(patientId)),
        dispatch(fetchDoctorPatients()),
      ]);
      router.push(`/doctor/patients/${patientId}?section=prs`);
      router.refresh();
    } catch (err) {
      console.error("Assign error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/doctor/patients/${patientId}?section=prs`)}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Patient
        </button>
      </div>

      <h1 className="text-2xl font-bold text-neutral-900">Assign Assessment</h1>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Select Condition</h2>
        <ConditionSelector conditions={safeConditions} selectedId={selectedCondition} onSelect={handleSelectCondition} />
      </section>

      {selectedCondition && currentCondition?.scales && currentCondition.scales.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-medium text-neutral-900">Included Scales</h3>
            <p className="text-xs text-neutral-500">
              {currentCondition.scales.length} scale{currentCondition.scales.length !== 1 ? "s" : ""} will be administered for this assessment
            </p>
            <div className="divide-y divide-neutral-100">
              {currentCondition.scales.map((scale) => (
                <div key={scale.scale_id} className="flex items-start justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-neutral-800">{scale.full_name}</p>
                    <p className="text-xs text-neutral-500">{scale.short_name} · {scale.category}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 shrink-0 ml-4">
                    <Clock className="h-3.5 w-3.5" />
                    <span>~{scale.estimated_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCondition && (
        <>
          <Card>
            <CardContent className="space-y-4">
              <h3 className="font-medium text-neutral-900">Session Details</h3>
              <Input label="Session Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Depression Assessment — March 2026" />
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Mode</label>
                <div className="flex gap-3">
                  {[
                    { value: "self" as const, label: "Patient Self-Report" },
                    { value: "clinician_administered" as const, label: "Clinician Administered" },
                    { value: "voice" as const, label: "Voice Assisted" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setMode(opt.value)}
                      className={`px-4 py-2 rounded-lg text-sm border transition-colors ${mode === opt.value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Due Date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Clinical Notes (internal)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Notes visible only to clinicians..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Patient Instructions</label>
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none" placeholder="Instructions shown to the patient..." />
              </div>
            </CardContent>
          </Card>

          <Button size="lg" className="w-full" onClick={handleAssign} isLoading={isSubmitting}>
            Assign Assessment to Patient
          </Button>
        </>
      )}
    </div>
  );
}
