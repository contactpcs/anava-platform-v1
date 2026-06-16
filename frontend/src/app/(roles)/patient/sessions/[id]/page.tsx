"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, ArrowRight } from "lucide-react";
import { useSessions, useScales } from "@/lib/hooks";
import { PageLoader, Button, Card, CardContent } from "@/components/ui";
import type { Scale } from "@/types/prs.types";

export default function SessionOverview() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentSession, loadSession } = useSessions();
  const { scalesById } = useScales();

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  // Resolve the session's ordered scale list against the cached catalog. Memoized
  // so the array identity is stable across re-renders that don't change inputs.
  const scales = useMemo<Scale[]>(() => {
    if (!currentSession?.resolved_scale_ids) return [];
    return currentSession.resolved_scale_ids
      .map((sid) => scalesById[sid])
      .filter(Boolean) as Scale[];
  }, [currentSession, scalesById]);

  if (!currentSession) return <PageLoader />;

  const totalMinutes = scales.reduce((sum, s) => sum + s.estimated_minutes, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          {currentSession.title || currentSession.condition_id || "Assessment"}
        </h1>
        <div className="flex items-center gap-4 mt-2 text-sm text-neutral-500">
          <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> ~{totalMinutes} min</span>
          <span>{scales.length} questionnaires</span>
        </div>
      </div>

      {currentSession.patient_instructions && (
        <Card>
          <CardContent>
            <p className="text-sm text-neutral-700">{currentSession.patient_instructions}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h3 className="font-medium text-neutral-900 mb-3">Questionnaires in this assessment:</h3>
          <div className="space-y-2">
            {scales.map((scale, i) => {
              const response = currentSession.scale_responses?.find(r => r.scale_id === scale.scale_id);
              const isDone = response?.status === "completed";
              return (
                <div key={scale.scale_id} className="flex items-center justify-between px-3 py-2.5 bg-neutral-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-neutral-400 w-5">{i + 1}.</span>
                    <div>
                      <span className="text-sm font-medium text-neutral-800">{scale.short_name}</span>
                      <span className="text-xs text-neutral-500 ml-2">{scale.full_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Clock className="h-3 w-3" /> ~{scale.estimated_minutes} min
                    {isDone && <span className="text-success-500 font-medium ml-2">Done</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Button size="lg" className="w-full" onClick={() => router.push(`/patient/sessions/${id}/consent`)}>
        I Agree &amp; Begin Assessment <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
