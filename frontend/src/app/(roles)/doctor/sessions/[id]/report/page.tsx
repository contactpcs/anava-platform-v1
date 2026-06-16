"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useSessions, useScales } from "@/lib/hooks";
import { PageLoader, Card, CardContent } from "@/components/ui";
import { ScaleResultCard, RiskAlertBanner, SeverityBadge } from "@/components/assessment";
import { formatDate } from "@/lib/utils/format";

export default function ReportViewPage() {
  const { id } = useParams<{ id: string }>();
  const { currentSession, loadSession } = useSessions();
  const { scalesById: scales } = useScales();

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  if (!currentSession) return <PageLoader />;

  const responses = currentSession.scale_responses || [];
  const alerts = currentSession.risk_alerts || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Assessment Report</h1>
          <p className="text-sm text-neutral-500">
            {currentSession.title} — {currentSession.completed_at ? formatDate(currentSession.completed_at) : "In Progress"}
          </p>
        </div>
        {currentSession.overall_severity && (
          <div>
            <p className="text-xs text-neutral-500 uppercase mb-1">Overall Severity</p>
            <SeverityBadge level={currentSession.overall_severity} label={currentSession.overall_severity} />
          </div>
        )}
      </div>

      {/* Summary stats */}
      <Card>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-neutral-900">{currentSession.scales_completed}</p>
            <p className="text-xs text-neutral-500">Scales Completed</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-neutral-900">{currentSession.scales_total}</p>
            <p className="text-xs text-neutral-500">Total Scales</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-danger-500">{currentSession.risk_flag_count}</p>
            <p className="text-xs text-neutral-500">Risk Flags</p>
          </div>
          <div>
            <p className="text-2xl font-bold capitalize text-neutral-900">{currentSession.overall_severity || "—"}</p>
            <p className="text-xs text-neutral-500">Severity</p>
          </div>
        </CardContent>
      </Card>

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      {/* Per-scale results */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {responses.map((r) => (
          <ScaleResultCard key={r.id} response={r} scaleName={scales[r.scale_id]?.full_name || r.scale_id} />
        ))}
      </div>
    </div>
  );
}
