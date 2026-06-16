"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { prsService } from "@/lib/api/services";
import { useScales } from "@/lib/hooks";
import { PageLoader, Card, CardContent } from "@/components/ui";
import { SeverityBadge } from "@/components/assessment";
import { formatDate } from "@/lib/utils/format";
import type { ScoreHistory } from "@/types/prs.types";

export default function TrendsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const [history, setHistory] = useState<ScoreHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  // Scales come from the cached catalog — no need to refetch when navigating
  // between trends pages for different patients.
  const { scalesById: scales } = useScales();

  useEffect(() => {
    setHistoryLoading(true);
    prsService.getScoreHistory(patientId)
      .then(({ history: h }) => setHistory(h))
      .finally(() => setHistoryLoading(false));
  }, [patientId]);

  if (historyLoading) return <PageLoader />;

  // Group history by scale_id
  const grouped = history.reduce<Record<string, ScoreHistory[]>>((acc, h) => {
    if (!acc[h.scale_id]) acc[h.scale_id] = [];
    acc[h.scale_id].push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Score Trends</h1>

      {Object.entries(grouped).map(([scaleId, records]) => (
        <Card key={scaleId}>
          <CardContent>
            <h3 className="font-medium text-neutral-900 mb-3">{scales[scaleId]?.full_name || scaleId}</h3>
            <div className="space-y-2">
              {records.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-neutral-600">{formatDate(r.recorded_at)}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-neutral-900">
                      {r.total_score}{r.max_possible_score ? `/${r.max_possible_score}` : ""}
                    </span>
                    {r.severity_level && <SeverityBadge level={r.severity_level} label={r.severity_label || r.severity_level} />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(grouped).length === 0 && (
        <p className="text-center text-neutral-500 py-12">No score history available yet</p>
      )}
    </div>
  );
}
