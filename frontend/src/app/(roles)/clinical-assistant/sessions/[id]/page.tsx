"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Play, FileText } from "lucide-react";
import { useSessions, useScales } from "@/lib/hooks";
import { PageLoader, Button } from "@/components/ui";
import { RiskAlertBanner, ScaleResultCard } from "@/components/assessment";

export default function CASessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentSession, loadSession } = useSessions();
  const { scalesById: scales } = useScales();

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  if (!currentSession) return <PageLoader />;

  const responses = currentSession.scale_responses || [];
  const alerts = currentSession.risk_alerts || [];
  const isCompleted = currentSession.status === "completed";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{currentSession.title || "Session Detail"}</h1>
          <p className="text-sm text-neutral-500 capitalize mt-1">Status: {currentSession.status.replace("_", " ")}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/clinical-assistant/sessions/${id}/conduct`}>
            <Button variant="outline"><Play className="h-4 w-4" /> Conduct Assessment</Button>
          </Link>
          {isCompleted && (
            <Link href={`/clinical-assistant/sessions/${id}/report`}>
              <Button><FileText className="h-4 w-4" /> View Report</Button>
            </Link>
          )}
        </div>
      </div>

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {responses.map((r) => (
          <ScaleResultCard key={r.id} response={r} scaleName={scales[r.scale_id]?.full_name || r.scale_id} />
        ))}
      </div>
    </div>
  );
}
