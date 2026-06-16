"use client";

import Link from "next/link";
import { CheckCircle, ChevronRight, Activity } from "lucide-react";
import { useMyScores } from "@/lib/hooks";
import { PageLoader, Card, CardContent } from "@/components/ui";

function severityColor(level?: string) {
  switch (level?.toLowerCase()) {
    case "mild":     return "text-yellow-700 bg-yellow-50";
    case "moderate": return "text-orange-700 bg-orange-50";
    case "severe":   return "text-red-700 bg-red-50";
    case "normal":
    case "none":     return "text-green-700 bg-green-50";
    default:         return "text-neutral-600 bg-neutral-100";
  }
}

export default function PatientResultsPage() {
  const { scores: instances, isLoading } = useMyScores();

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">My Results</h1>

      {instances.length === 0 ? (
        <p className="text-neutral-500 text-center py-12">No completed assessments yet.</p>
      ) : (
        <div className="space-y-4">
          {instances.map((inst) => (
            <Link key={inst.instance_id} href={`/patient/results/${inst.instance_id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {inst.disease_name ?? inst.disease_id}
                        </p>
                        {inst.completed_at && (
                          <p className="text-xs text-neutral-400 mt-0.5">
                            Completed {new Date(inst.completed_at).toLocaleDateString("en-US", {
                              year: "numeric", month: "short", day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {inst.severity_label && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${severityColor(inst.severity_level)}`}>
                          {inst.severity_label}
                        </span>
                      )}
                      {inst.disease_score != null && (
                        <p className="text-sm font-bold text-neutral-900">
                          {inst.disease_score.toFixed(0)}
                          {inst.percentage != null && (
                            <span className="text-neutral-400 font-normal text-xs"> ({inst.percentage.toFixed(0)}%)</span>
                          )}
                        </p>
                      )}
                      <ChevronRight className="h-4 w-4 text-neutral-400" />
                    </div>
                  </div>

                  {/* Per-scale summary */}
                  {inst.scale_summaries && inst.scale_summaries.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-100">
                      {inst.scale_summaries.map((s) => (
                        <div
                          key={s.scale_id}
                          className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Activity className="h-3.5 w-3.5 text-primary-400 flex-shrink-0" />
                            <span className="text-xs text-neutral-700 truncate">
                              {s.scale_name ?? s.scale_code ?? s.scale_id}
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            {s.calculated_value != null && (
                              <span className="text-xs font-semibold text-neutral-900">
                                {s.calculated_value}
                                {s.max_possible != null && (
                                  <span className="text-neutral-400 font-normal"> /{s.max_possible}</span>
                                )}
                              </span>
                            )}
                            {s.severity_label && (
                              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded ${severityColor(s.severity_level)}`}>
                                {s.severity_label}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
