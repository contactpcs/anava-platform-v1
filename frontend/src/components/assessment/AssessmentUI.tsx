"use client";

import {
  RotateCcw,
  Info,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import { STTBar } from "@/components/questionnaire/STTBar";
import { cn } from "@/lib/utils/cn";
import type { ScaleQuestion } from "@/types/prs.types";
import type { STTPhase } from "@/lib/hooks/useAssessmentSTT";

interface AssessmentUIProps {
  scales: Array<{
    scale_id: string;
    scale_name: string;
    short_name: string;
    disease_type?: string;
    description?: string;
    instructions?: string;
    estimated_duration?: string;
    content_type?: string;
  }>;
  currentScaleIndex: number;
  currentQuestionIndex: number;
  completedScaleIds: Set<string>;

  questions: ScaleQuestion[];
  responses: Record<string, Record<string, number | string>>;

  totalScales: number;
  isFirstScale: boolean;
  isLastScale: boolean;
  questionsAnswered: number;
  isResumed?: boolean;

  onAnswer: (questionIndex: number, value: number | string) => void;
  onPrev: () => void;
  onSkipSection: () => void;
  onSubmitScale: () => void;
  onNavigateScale: (index: number) => void;

  sttEnabled?: boolean;
  onToggleStt?: (enabled: boolean) => void;
  sttPhase?: STTPhase;
  sttTranscript?: string;
  sttMatchedLabel?: string | null;
  sttHint?: string | null;
  isSttsupported?: boolean;

  isSubmitting?: boolean;
}

export function AssessmentUI({
  scales,
  currentScaleIndex,
  currentQuestionIndex,
  completedScaleIds,
  questions,
  responses,
  totalScales,
  isFirstScale,
  isLastScale,
  questionsAnswered,
  isResumed,
  onAnswer,
  onPrev,
  onSkipSection,
  onSubmitScale,
  onNavigateScale,
  sttEnabled,
  onToggleStt,
  sttPhase,
  sttTranscript,
  sttMatchedLabel,
  sttHint,
  isSttsupported,
  isSubmitting,
}: AssessmentUIProps) {
  const currentScale = scales[currentScaleIndex];
  const totalQuestions = questions.length;
  const questionsRemaining = totalQuestions - questionsAnswered;
  const scaleNumber = currentScaleIndex + 1;
  const overallProgress =
    totalScales > 0 ? Math.round((completedScaleIds.size / totalScales) * 100) : 0;

  const sidebarScales = scales.map((s) => ({
    scale_id: s.scale_id,
    short_name: s.short_name || s.scale_name,
    scale_name: s.scale_name,
  }));

  if (!currentScale) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-300 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  const scaleResponses = responses[currentScale.scale_id] ?? {};

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mb-6 bg-neutral-50">
      {/* Sidebar */}
      <ProgressSidebar
        scales={sidebarScales}
        currentIndex={currentScaleIndex}
        completedScaleIds={completedScaleIds}
        responses={responses}
        onNavigate={onNavigateScale}
        overallProgress={overallProgress}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Resumed Banner */}
        {isResumed && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border-b border-amber-200 px-8 py-2.5">
            <RotateCcw className="h-3.5 w-3.5" />
            Resuming from where you left off
          </div>
        )}

        {/* Dark Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            {/* Scale number badge */}
            <div className="flex-shrink-0 w-12 h-12 bg-orange-500 rounded-xl flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none">{scaleNumber}</span>
              <span className="text-[10px] text-orange-100">of {totalScales}</span>
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              {currentScale.disease_type && (
                <span className="inline-flex items-center px-2 py-0.5 bg-amber-700 text-amber-100 text-xs font-bold rounded uppercase tracking-wide mb-1">
                  {currentScale.disease_type}
                </span>
              )}
              <h1 className="text-lg font-bold leading-tight">{currentScale.scale_name}</h1>
              {currentScale.description && (
                <p className="text-slate-400 text-xs leading-relaxed mt-0.5 truncate">{currentScale.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Today</span>
            </div>
            {currentScale.content_type && (
              <div className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>{currentScale.content_type}</span>
              </div>
            )}
            {currentScale.estimated_duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>~{currentScale.estimated_duration}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 px-2.5 py-0.5 bg-orange-50 border border-orange-200 rounded-full text-orange-700 text-xs font-medium">
              <CheckCircle className="w-3 h-3" />
              {questionsAnswered} of {totalQuestions} answered
            </div>
          </div>
        </div>

        {/* STT Bar */}
        {sttEnabled && (
          <STTBar
            phase={sttPhase ?? "idle"}
            transcript={sttTranscript ?? ""}
            matchedLabel={sttMatchedLabel ?? null}
            hint={sttHint ?? null}
          />
        )}

        {/* Scrollable Questions */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-4">
            {/* Instructions box */}
            {currentScale.instructions && (
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">{currentScale.instructions}</p>
              </div>
            )}

            {/* All questions */}
            <div className="space-y-3">
              {questions.map((question, idx) => {
                const qValue = scaleResponses[String(idx)];
                const isAnswered = qValue !== undefined;
                const isCurrentStt = idx === currentQuestionIndex && sttEnabled;

                return (
                  <div
                    key={`${currentScale.scale_id}-${idx}`}
                    className={cn(
                      "rounded-xl border p-4 shadow-sm transition-all",
                      isCurrentStt
                        ? "border-primary-300 bg-primary-50/20"
                        : "border-neutral-200 bg-white",
                    )}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className="relative flex-shrink-0 mt-0.5">
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            isAnswered ? "bg-green-500 text-white" : "bg-orange-500 text-white",
                          )}
                        >
                          {idx + 1}
                        </div>
                        {isCurrentStt && sttPhase === "listening" && (
                          <span className="absolute -inset-1 rounded-full bg-red-400 opacity-30 animate-ping" />
                        )}
                        {isCurrentStt && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 flex items-center justify-center">
                            <Mic className="w-2 h-2 text-white" />
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-neutral-900 leading-snug flex-1">
                        {question.label}
                      </h3>
                    </div>
                    <div className="pl-9">
                      <QuestionRenderer
                        question={question}
                        scaleId={currentScale.scale_id}
                        value={qValue}
                        onAnswer={onAnswer}
                        questionNumber={idx + 1}
                        totalQuestions={totalQuestions}
                        showHeader={false}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={onPrev} disabled={isFirstScale}>
              <ChevronLeft className="h-4 w-4" />
              Previous Scale
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-amber-600 font-medium">
                <Info className="w-4 h-4" />
                {questionsRemaining} question{questionsRemaining !== 1 ? "s" : ""} remaining
              </div>

              {isSttsupported && onToggleStt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleStt(!sttEnabled)}
                  className={cn(
                    sttEnabled
                      ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {sttEnabled ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      Stop Voice
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Voice Input
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={onSkipSection}
                className="text-orange-600 border-orange-300 hover:bg-orange-50"
              >
                <SkipForward className="h-4 w-4" />
                Skip Scale
              </Button>
            </div>

            <Button onClick={onSubmitScale} isLoading={isSubmitting}>
              {isLastScale ? "Submit Assessment" : "Next Scale"}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
