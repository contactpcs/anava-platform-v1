"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, AlertTriangle, User } from "lucide-react";
import { usePatientResult } from "@/lib/hooks";
import { PageLoader, Card, CardContent } from "@/components/ui";

function severityColor(level?: string) {
  switch (level?.toLowerCase()) {
    case "mild":     return "text-yellow-700 bg-yellow-50 border-yellow-200";
    case "moderate": return "text-orange-700 bg-orange-50 border-orange-200";
    case "severe":   return "text-red-700 bg-red-50 border-red-200";
    case "normal":
    case "none":     return "text-green-700 bg-green-50 border-green-200";
    default:         return "text-neutral-600 bg-neutral-100 border-neutral-200";
  }
}

export default function DoctorPatientResultPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const instanceId = searchParams.get("instance_id") || "";
  const router = useRouter();
  const detail = usePatientResult(patientId, instanceId);
  const isLoading = !detail;
  const error = instanceId && !isLoading && !detail;

  if (isLoading && instanceId) return <PageLoader />;

  if (!instanceId || error || !detail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef] dark:from-neutral-900 dark:to-neutral-900 flex items-center justify-center">
        <p className="text-neutral-500">Could not load assessment results.</p>
      </div>
    );
  }

  const { instance, disease_result, scale_results } = detail;
  const overallResult = disease_result;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef] dark:from-neutral-900 dark:to-neutral-900">
      {/* Sub-header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            Back
          </button>
          <div className="flex items-center gap-2 text-sm text-neutral-500">
            <User className="h-4 w-4" />
            <span>Patient: {patientId}</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {instance.disease_name ?? "Assessment Results"}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-neutral-500">
            {instance.completed_at && (
              <span>
                Completed {new Date(instance.completed_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </span>
            )}
            <span className="capitalize bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">
              {instance.status ?? "completed"}
            </span>
          </div>
        </div>

        {/* Overall score card */}
        {overallResult && (
          <Card>
            <CardContent className="flex items-center justify-between gap-6">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Overall Disease Score</p>
                <p className="text-4xl font-bold text-neutral-900">
                  {overallResult.disease_score != null
                    ? overallResult.disease_score.toFixed(0)
                    : "—"}
                  <span className="text-lg text-neutral-400 font-normal"> /100</span>
                </p>
              </div>
              {overallResult.severity_label && (
                <div className="text-right">
                  <p className="text-xs text-neutral-500 mb-1">Severity</p>
                  <span className={`text-base font-semibold px-4 py-2 rounded-full border ${severityColor(overallResult.severity_level)}`}>
                    {overallResult.severity_label}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Per-scale results */}
        {scale_results.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
              Scale-by-Scale Breakdown
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scale_results.map((sr: any) => (
                <Card key={sr.scale_result_id ?? sr.scale_id}>
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">
                          {sr.scale_name ?? sr.scale_code ?? sr.scale_id}
                        </p>
                        {sr.scale_code && sr.scale_name && (
                          <p className="text-xs text-neutral-400">{sr.scale_code}</p>
                        )}
                      </div>
                      {sr.severity_label && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${severityColor(sr.severity_level)}`}>
                          {sr.severity_label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-neutral-900">
                        {sr.calculated_value ?? "—"}
                      </span>
                      {sr.max_possible != null && (
                        <span className="text-sm text-neutral-400">/ {sr.max_possible}</span>
                      )}
                      {sr.percentage != null && (
                        <span className="text-xs text-neutral-400 ml-1">({sr.percentage.toFixed(0)}%)</span>
                      )}
                    </div>

                    {/* Subscale scores */}
                    {sr.subscale_scores && Object.keys(sr.subscale_scores).length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-xs font-medium text-neutral-400 uppercase">Subscales</p>
                        {Object.entries(sr.subscale_scores).map(([key, sub]: [string, unknown]) => {
                          const s = sub as Record<string, unknown>;
                          return (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-neutral-500">{(s.name as string) || key}</span>
                              <span className="font-medium text-neutral-700">
                                {s.score as number}/{s.max_score as number}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Risk flags */}
                    {Array.isArray(sr.risk_flags) && sr.risk_flags.length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        <p className="text-xs font-medium text-orange-500 uppercase">Risk Flags</p>
                        {(sr.risk_flags as Record<string, unknown>[]).map((flag, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
                            <span className="text-xs text-neutral-600">{flag.message as string}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
