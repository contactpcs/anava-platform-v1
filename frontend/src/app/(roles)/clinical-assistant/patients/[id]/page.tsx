"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { staffService } from "@/lib/api/services/staff.service";
import { prsService } from "@/lib/api/services/prs.service";
import { PageLoader, Button, Card, CardContent } from "@/components/ui";
import { AssessmentCard, RiskAlertBanner } from "@/components/assessment";
import type { PatientDetail } from "@/types/domain.types";
import type { RiskAlert } from "@/types/prs.types";

export default function CAPatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { sessions, isLoading: sessionsLoading, loadPatientSessions } = useSessions();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPatientSessions(id);
    Promise.all([
      staffService.getPatient(id),
      prsService.getPatientAlerts(id, "active"),
    ]).then(([patientData, { alerts: a }]) => {
      setPatient(patientData);
      setAlerts(a);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [id, loadPatientSessions]);

  if (isLoading || sessionsLoading) return <PageLoader />;

  const fullName = patient?.full_name || "Patient";
  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
          <div className="flex items-center gap-3 text-sm text-neutral-500 mt-0.5">
            {age && <span>{age} yrs</span>}
            {patient?.gender && <span className="capitalize">{patient.gender}</span>}
            {patient?.email && <span>{patient.email}</span>}
            {patient?.mrn && <span>MRN: {patient.mrn}</span>}
          </div>
        </div>
        <Link href={`/clinical-assistant/patients/${id}/assign`}>
          <Button><Plus className="h-4 w-4" /> Assign Assessment</Button>
        </Link>
      </div>

      {patient?.condition && (
        <Card>
          <CardContent>
            <p className="text-xs text-neutral-500 uppercase mb-1">Condition</p>
            <p className="text-sm font-medium text-neutral-900">{patient.condition}</p>
          </CardContent>
        </Card>
      )}

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Sessions</h2>
        <div className="space-y-3">
          {sessions.map((s) => (
            <AssessmentCard key={s.id} session={s} basePath="/clinical-assistant" />
          ))}
          {sessions.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-neutral-500">No assessments assigned yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
