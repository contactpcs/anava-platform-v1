"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, ArrowRight, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button, PageLoader, Card, CardContent } from "@/components/ui";
import { useSessions } from "@/lib/hooks";
import { scoresService, type InstanceScoreDetail } from "@/lib/api/services/scores.service";

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

export default function SessionCompletePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentSession, loadSession } = useSessions();
  const [showResults, setShowResults] = useState(false);
  const [detail, setDetail] = useState<InstanceScoreDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);

  // Load session on mount
  useEffect(() => {
    loadSession(id);
  }, [id, loadSession]);

  // Fetch results when user clicks "Show Results"
  const handleShowResults = async () => {
    if (detail) {
      setShowResults(!showResults);
      return;
    }

    setIsLoading(true);
    setError(false);
    try {
      // Get latest instance for this session by fetching my scores and finding the most recent one
      const scores = await scoresService.getMyScores({ limit: 1 });
      if (scores.instances.length > 0) {
        const latestInstance = scores.instances[0];
        const resultDetail = await scoresService.getInstanceScore(latestInstance.instance_id);
        setDetail(resultDetail);
        setShowResults(true);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Failed to load results:", err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-8 px-4">
      {/* Completion Message */}
      {!showResults && (
        <div className="max-w-md mx-auto text-center space-y-6">
          <CheckCircle2 className="h-20 w-20 text-success-500 mx-auto" />

          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Assessment Complete</h1>
            <p className="text-neutral-500 mt-2">
              Thank you for completing all questionnaires. Your responses have been saved securely.
            </p>
          </div>

          <div className="bg-primary-50 rounded-xl px-6 py-4">
            <p className="text-sm text-primary-800">
              Your doctor will review the results and discuss them with you at your next consultation.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={handleShowResults} isLoading={isLoading} className="w-full">
              {isLoading ? "Loading Results..." : "Show Results"} <ChevronDown className="h-5 w-5" />
            </Button>
            <Link href="/patient/dashboard" className="w-full">
              <Button size="lg" variant="outline" className="w-full">
                Back to Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Results Display */}
      {showResults && detail && (
        <div className="space-y-6">
          <button
            onClick={handleShowResults}
            className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-800 font-medium"
          >
            <ChevronUp className="h-4 w-4" />
            Hide Results
          </button>

          {/* Header */}
          <div className="bg-gradient-to-r from-success-50 to-success-100 rounded-xl p-6 border border-success-200">
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">
              {detail.instance.disease_name ?? "Assessment Results"}
            </h1>
            {detail.instance.completed_at && (
              <p className="text-sm text-neutral-600 mt-2">
                Completed {new Date(detail.instance.completed_at).toLocaleDateString("en-US", {
                  year: "numeric", month: "long", day: "numeric",
                })}
              </p>
            )}
          </div>

          {/* Overall Score Card */}
          {(detail.weighted_result ?? detail.disease_result) && (
            <Card>
              <CardContent className="flex items-center justify-between gap-6">
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2 font-semibold">Overall Score</p>
                  <p className="text-5xl font-bold text-neutral-900">
                    {(detail.weighted_result?.disease_score ?? detail.disease_result?.disease_score)?.toFixed(0) ?? "—"}
                    <span className="text-xl text-neutral-400 font-normal ml-2">/100</span>
                  </p>
                </div>
                {(detail.weighted_result?.severity_label ?? detail.disease_result?.severity_label) && (
                  <span className={`text-lg font-semibold px-4 py-3 rounded-lg border ${severityColor(detail.weighted_result?.severity_level ?? detail.disease_result?.severity_level)}`}>
                    {detail.weighted_result?.severity_label ?? detail.disease_result?.severity_label}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Scale Breakdown */}
          {detail.scale_results.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-neutral-900">Scale Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {detail.scale_results.map((sr) => (
                  <Card key={sr.scale_result_id ?? sr.scale_id}>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-neutral-900">
                            {sr.scale_name ?? sr.scale_code ?? sr.scale_id}
                          </p>
                          {sr.scale_code && sr.scale_name && (
                            <p className="text-xs text-neutral-400 mt-0.5">{sr.scale_code}</p>
                          )}
                        </div>
                        {sr.severity_label && (
                          <span className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 whitespace-nowrap ${severityColor(sr.severity_level)}`}>
                            {sr.severity_label}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-neutral-900">
                          {sr.calculated_value ?? "—"}
                        </span>
                        {sr.max_possible != null && (
                          <span className="text-sm text-neutral-400">/ {sr.max_possible}</span>
                        )}
                        {sr.percentage != null && (
                          <span className="text-xs text-neutral-400 ml-1">({sr.percentage.toFixed(0)}%)</span>
                        )}
                      </div>

                      {/* Subscale Scores */}
                      {sr.subscale_scores && Object.keys(sr.subscale_scores).length > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          <p className="text-xs font-semibold text-neutral-500 uppercase">Subscales</p>
                          {Object.entries(sr.subscale_scores).map(([key, sub]: [string, unknown]) => {
                            const s = sub as Record<string, unknown>;
                            return (
                              <div key={key} className="flex justify-between text-xs bg-neutral-50 px-2 py-1.5 rounded">
                                <span className="text-neutral-600">{(s.name as string) || key}</span>
                                <span className="font-semibold text-neutral-700">
                                  {s.score as number}/{s.max_score as number}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Risk Flags */}
                      {Array.isArray(sr.risk_flags) && sr.risk_flags.length > 0 && (
                        <div className="border-t pt-3 space-y-2">
                          {(sr.risk_flags as Record<string, unknown>[]).map((flag, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
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

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
            <Link href="/patient/dashboard" className="flex-1">
              <Button size="lg" variant="outline" className="w-full">
                Back to Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <button
              onClick={handleShowResults}
              className="flex-1 px-6 py-3 bg-neutral-100 text-neutral-900 font-medium rounded-lg hover:bg-neutral-200 transition-colors"
            >
              Hide Results <ChevronUp className="h-5 w-5 ml-2 inline" />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {showResults && error && (
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-neutral-900 mb-2">Could not load results</h2>
            <p className="text-neutral-500 mb-6">
              Your responses have been saved. Please try again in a moment.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button onClick={handleShowResults} className="w-full">
              Try Again
            </Button>
            <Link href="/patient/dashboard" className="w-full">
              <Button size="lg" variant="outline" className="w-full">
                Back to Dashboard <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
