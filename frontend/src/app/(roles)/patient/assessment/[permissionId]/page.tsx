"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AssessmentSkeleton } from "@/components/ui";
import { AssessmentUI } from "@/components/assessment/AssessmentUI";
import { useAssessmentSTT } from "@/lib/hooks/useAssessmentSTT";
import { patientsService } from "@/lib/api/services/patients.service";
import { prsAssessmentService } from "@/lib/api/services/prsAssessment.service";
import { useAppDispatch } from "@/store/hooks";
import {
  invalidateDashboard,
  invalidateMyAssessments,
  fetchMyAssessments,
  fetchPatientDashboard,
} from "@/store/slices/patientsSlice";
import {
  invalidateMyScores,
  fetchMyScoresSummary,
} from "@/store/slices/scoresSlice";
import type { ScaleQuestion, QuestionOption } from "@/types/prs.types";
import type { PrsAssessmentQuestion, PrsAssessmentScaleResult } from "@/lib/api/services/prsAssessment.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadedScale = {
  scale_id: string;
  scale_name: string;
  instance_id: string;
  questions: ScaleQuestion[];
  question_ids: string[];
  question_required: boolean[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapAnswerType(raw: string): ScaleQuestion["type"] {
  switch (raw) {
    case "radio":
    case "likert":
    case "checkbox":
    case "multiple_choice":
      return "likert";
    case "slider":
    case "vas":
    case "nrs":
      return "vas";
    case "number":
    case "integer":
    case "numeric":
      return "numeric";
    case "time":
      return "time";
    default:
      return "text";
  }
}

function toLoadedScale(scale: PrsAssessmentScaleResult, instanceId: string): LoadedScale {
  return {
    scale_id: scale.scale_id,
    scale_name: scale.scale_name ?? scale.scale_code ?? scale.scale_id,
    instance_id: instanceId,
    questions: scale.questions.map(toPrsScaleQuestion),
    question_ids: scale.questions.map((q) => q.question_id),
    question_required: scale.questions.map((q) => q.is_required ?? true),
  };
}

function toPrsScaleQuestion(q: PrsAssessmentQuestion): ScaleQuestion {
  const type = mapAnswerType(q.answer_type);
  const options: QuestionOption[] | undefined = q.options?.length
    ? q.options
        .slice()
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((o) => ({ value: Number(o.value), label: o.label, points: o.points }))
    : undefined;

  return {
    index: q.question_index,
    label: q.question_text,
    type,
    required: q.is_required ?? true,
    options,
    min: q.min_value ?? undefined,
    max: q.max_value ?? undefined,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientAssessmentPage() {
  const { permissionId } = useParams<{ permissionId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [scales, setScales] = useState<LoadedScale[]>([]);
  const [currentScaleIndex, setCurrentScaleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, number | string>>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [isResumed, setIsResumed] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const { permissions } = await patientsService.getMyAssessments();
        const permission = permissions.find((p) => p.permission_id === permissionId);
        if (!permission) throw new Error("Assessment not found");

        const result = await prsAssessmentService.startAssessment({
          disease_id: permission.disease_id,
          taken_by: "patient",
        });

        if (result.scales.length === 0) throw new Error("No scales found for this assessment");

        const loadedScales: LoadedScale[] = result.scales.map((scale) =>
          toLoadedScale(scale, result.instance_id),
        );
        setScales(loadedScales);

        const alreadyCompleted = new Set(
          result.scales.filter((s) => s.is_completed).map((s) => s.scale_id),
        );
        setCompletedScaleIds(alreadyCompleted);

        if (result.is_resumed) {
          setIsResumed(true);
          try {
            const saved = await prsAssessmentService.getResponses(result.instance_id);
            const byQid = saved.responses_by_qid;

            const restoredResponses: Record<string, Record<string, number | string>> = {};
            for (const scale of loadedScales) {
              const scaleMap: Record<string, number | string> = {};
              scale.question_ids.forEach((qid, idx) => {
                const entry = byQid[qid];
                if (entry) {
                  scaleMap[String(idx)] =
                    entry.response_value !== null && entry.response_value !== undefined
                      ? entry.response_value
                      : entry.given_response;
                }
              });
              if (Object.keys(scaleMap).length > 0) {
                restoredResponses[scale.scale_id] = scaleMap;
              }
            }
            setResponses(restoredResponses);

            const firstIncompleteIdx = loadedScales.findIndex(
              (s) => !alreadyCompleted.has(s.scale_id),
            );
            if (firstIncompleteIdx >= 0) {
              setCurrentScaleIndex(firstIncompleteIdx);
              setCurrentQuestionIndex(0);
            }
          } catch {
            // If restoring saved responses fails, continue from the beginning
          }
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
            ?.message ??
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (e as { message?: string })?.message ??
          "Failed to load assessment";
        setLoadError(String(msg));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [permissionId]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const currentScale = scales[currentScaleIndex];
  const questions = currentScale?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const isFirstScale = currentScaleIndex === 0;
  const isLastScale = currentScaleIndex >= scales.length - 1;
  const questionKey = `${currentScaleIndex}-${currentQuestionIndex}`;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (questionIndex: number, value: number | string) => {
      const scaleId = currentScale?.scale_id;
      if (!scaleId) return;
      setResponses((prev) => ({
        ...prev,
        [scaleId]: { ...(prev[scaleId] ?? {}), [String(questionIndex)]: value },
      }));
      const questionId = currentScale.question_ids[questionIndex];
      if (questionId) {
        prsAssessmentService
          .saveResponse(currentScale.instance_id, scaleId, questionIndex, questionId, value)
          .catch(() => {});
      }
    },
    [currentScale],
  );

  const handleAutoAdvance = useCallback(() => {
    setCurrentQuestionIndex((prev) => {
      if (prev < totalQuestions - 1) return prev + 1;
      return prev;
    });
  }, [totalQuestions]);

  const handlePrev = () => {
    if (!isFirstScale) {
      setCurrentScaleIndex((i) => i - 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleSkipSection = () => {
    setResponses((prev) => {
      const next = { ...prev };
      delete next[currentScale.scale_id];
      return next;
    });
    if (isLastScale) {
      handleSubmitScale();
    } else {
      setCurrentScaleIndex((i) => i + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleSubmitScale = async () => {
    if (!currentScale) return;
    setIsSubmitting(true);
    try {
      const scaleResponses = responses[currentScale.scale_id] ?? {};
      await prsAssessmentService.submitAssessment(
        currentScale.instance_id,
        currentScale.scale_id,
        scaleResponses,
      );
      const newCompleted = new Set(completedScaleIds).add(currentScale.scale_id);
      setCompletedScaleIds(newCompleted);
      if (isLastScale) {
        const skipped = scales.filter((s) => !newCompleted.has(s.scale_id));
        await Promise.all(
          skipped.map((s) => prsAssessmentService.submitAssessment(s.instance_id, s.scale_id, {})),
        );
        dispatch(invalidateMyAssessments());
        dispatch(invalidateMyScores());
        dispatch(invalidateDashboard());
        await Promise.all([
          dispatch(fetchMyAssessments()),
          dispatch(fetchMyScoresSummary()),
          dispatch(fetchPatientDashboard()),
        ]);
        router.push("/patient/dashboard?section=prs");
        router.refresh();
      } else {
        setCurrentScaleIndex((i) => i + 1);
        setCurrentQuestionIndex(0);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
          ?.message ??
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as { message?: string })?.message ??
        "Failed to submit";
      alert(String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── STT ──────────────────────────────────────────────────────────────────
  const { phase, transcript, matchedLabel, hint, isSupported } = useAssessmentSTT({
    questionKey,
    question: currentQuestion,
    enabled: sttEnabled && !isSubmitting,
    onAnswer: handleAnswer,
    onAutoAdvance: handleAutoAdvance,
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <AssessmentSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );
  }

  if (!currentScale) return <AssessmentSkeleton />;

  const scalesWithMetadata = scales.map((scale) => ({
    scale_id: scale.scale_id,
    scale_name: scale.scale_name,
    short_name: scale.scale_name,
    description: "A standardized measure of health-related quality of life",
    instructions: "Under each heading, please tick the ONE box that best describes your health TODAY.",
    estimated_duration: "5 min",
  }));

  const questionsAnswered = Object.keys(responses[currentScale.scale_id] ?? {}).length;

  return (
    <AssessmentUI
      scales={scalesWithMetadata}
      currentScaleIndex={currentScaleIndex}
      currentQuestionIndex={currentQuestionIndex}
      completedScaleIds={completedScaleIds}
      questions={questions}
      responses={responses}
      totalScales={scales.length}
      isFirstScale={isFirstScale}
      isLastScale={isLastScale}
      questionsAnswered={questionsAnswered}
      isResumed={isResumed}
      onAnswer={handleAnswer}
      onPrev={handlePrev}
      onSkipSection={handleSkipSection}
      onSubmitScale={handleSubmitScale}
      onNavigateScale={(idx) => {
        setCurrentScaleIndex(idx);
        setCurrentQuestionIndex(0);
      }}
      sttEnabled={sttEnabled}
      onToggleStt={setSttEnabled}
      sttPhase={phase}
      sttTranscript={transcript}
      sttMatchedLabel={matchedLabel}
      sttHint={hint}
      isSttsupported={isSupported}
      isSubmitting={isSubmitting}
    />
  );
}
