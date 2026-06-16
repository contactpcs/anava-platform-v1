"use client";

import { Card, CardContent } from "@/components/ui";
import { SeverityBadge } from "./SeverityBadge";
import { formatScore } from "@/lib/utils/format";
import type { ScaleResponse } from "@/types/prs.types";

interface ScaleResultCardProps {
  response: ScaleResponse;
  scaleName: string;
}

export function ScaleResultCard({ response, scaleName }: ScaleResultCardProps) {
  if (response.status !== "completed" && response.status !== "clinician_completed") {
    return (
      <Card className="opacity-60">
        <CardContent>
          <h4 className="font-medium text-neutral-700">{scaleName}</h4>
          <p className="text-sm text-neutral-400 mt-1 capitalize">{response.status.replace("_", " ")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-medium text-neutral-900">{scaleName}</h4>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-2xl font-bold text-neutral-900">
                {response.total_score !== null ? response.total_score : "—"}
              </span>
              {response.max_possible_score && (
                <span className="text-sm text-neutral-500">
                  / {response.max_possible_score}
                </span>
              )}
              {response.percentage !== null && (
                <span className="text-sm text-neutral-400">({response.percentage}%)</span>
              )}
            </div>
          </div>
          {response.severity_level && (
            <SeverityBadge level={response.severity_level} label={response.severity_label || response.severity_level} />
          )}
        </div>

        {response.subscale_scores && Object.keys(response.subscale_scores).length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Subscales</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(response.subscale_scores).map(([key, sub]: [string, any]) => (
                <div key={key} className="flex items-center justify-between bg-neutral-50 rounded px-2 py-1.5">
                  <span className="text-xs text-neutral-600">{sub.name || key}</span>
                  <span className="text-xs font-medium">{sub.score}/{sub.max_score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {response.domain_scores && Object.keys(response.domain_scores).length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-medium text-neutral-500 uppercase mb-2">Domains</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(response.domain_scores).map(([key, dom]: [string, any]) => (
                <div key={key} className="flex items-center justify-between bg-neutral-50 rounded px-2 py-1.5">
                  <span className="text-xs text-neutral-600">{dom.name || key}</span>
                  <span className="text-xs font-medium">{dom.score}/{dom.max_score}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {response.is_positive !== null && (
          <div className="mt-3 border-t pt-3">
            <span className={`text-sm font-medium ${response.is_positive ? "text-danger-500" : "text-success-500"}`}>
              {response.is_positive ? "Positive (above cutoff)" : "Negative (below cutoff)"}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
