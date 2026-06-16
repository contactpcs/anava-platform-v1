"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuestionnaire, useSessions } from "@/lib/hooks";
import { useAssessmentSTT } from "@/lib/hooks/useAssessmentSTT";
import { prsService } from "@/lib/api/services";
import dynamic from "next/dynamic";
import { PageLoader } from "@/components/ui";

const AssessmentUI = dynamic(
  () => import("@/components/assessment/AssessmentUI").then((m) => ({ default: m.AssessmentUI })),
  { loading: () => <PageLoader />, ssr: false },
);
import type { ScaleDefinition } from "@/types/prs.types";

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentSession, loadSession } = useSessions();
  const questionnaire = useQuestionnaire();
  const [scaleDefinitions, setScaleDefinitions] = useState<Record<string, ScaleDefinition>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  useEffect(() => {
    if (currentSession && !questionnaire.sessionId) {
      const existingResponses: Record<string, Record<string, number | string>> = {};
      const completed = new Set<string>();
      currentSession.scale_responses?.forEach((r) => {
        if (r.responses) existingResponses[r.scale_id] = r.responses;
        if (r.status === "completed") completed.add(r.scale_id);
      });
      setCompletedScaleIds(completed);
      questionnaire.init(id, currentSession.resolved_scale_ids, existingResponses);
    }
  }, [currentSession]);

  // Load current scale definition on demand
  useEffect(() => {
    if (!questionnaire.currentScaleId || scaleDefinitions[questionnaire.currentScaleId]) return;
    prsService.getScale(questionnaire.currentScaleId).then((scale) => {
      const def = (scale as any).definition || scale;
      setScaleDefinitions((prev) => ({ ...prev, [questionnaire.currentScaleId!]: def }));
    });
  }, [questionnaire.currentScaleId]);

  // Pre-load all scale definitions for sidebar labels
  useEffect(() => {
    if (!currentSession) return;
    currentSession.resolved_scale_ids.forEach((sid) => {
      if (!scaleDefinitions[sid]) {
        prsService.getScale(sid).then((scale) => {
          const def = (scale as any).definition || scale;
          setScaleDefinitions((prev) => ({ ...prev, [sid]: def }));
        }).catch(() => {});
      }
    });
  }, [currentSession]);

  // ─── Derive state safely (before early returns so hooks order stays fixed) ─

  const currentScaleId = questionnaire.currentScaleId;
  const currentDef = currentScaleId ? scaleDefinitions[currentScaleId] : undefined;
  const questions = currentDef?.questions ?? [];
  const totalQuestions = questions.length;
  const questionsAnswered = Object.keys(questionnaire.currentResponses).length;
  const currentQuestion = questions[questionnaire.currentQuestionIndex];
  const questionKey = `${questionnaire.currentScaleIndex}-${questionnaire.currentQuestionIndex}`;

  const handleAnswer = useCallback(
    (questionIndex: number, value: number | string) => {
      if (!currentScaleId) return;
      questionnaire.answer(currentScaleId, questionIndex, value);
    },
    [questionnaire, currentScaleId],
  );

  const handleAutoAdvance = useCallback(() => {
    questionnaire.nextQuestion(totalQuestions);
  }, [questionnaire, totalQuestions]);

  // ─── STT ──────────────────────────────────────────────────────────────────
  const { phase, transcript, matchedLabel, hint, isSupported } = useAssessmentSTT({
    questionKey,
    question: currentQuestion,
    enabled: sttEnabled && !isSubmitting,
    onAnswer: handleAnswer,
    onAutoAdvance: handleAutoAdvance,
  });

  // ─── Early returns (after all hooks) ──────────────────────────────────────
  if (!currentSession || !currentScaleId) return <PageLoader />;
  if (!currentDef) return <PageLoader />;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleSubmitScale = async () => {
    setIsSubmitting(true);
    try {
      const result = await questionnaire.submitCurrentScale();
      if (result) {
        const newCompleted = new Set(completedScaleIds).add(currentScaleId);
        setCompletedScaleIds(newCompleted);
        if (result.session_completed || questionnaire.isLastScale) {
          const skippedIds = currentSession.resolved_scale_ids.filter(
            (sid) => !newCompleted.has(sid),
          );
          await Promise.all(skippedIds.map((sid) => prsService.submitResponse(id, sid, {})));
          router.push(`/patient/sessions/${id}/complete`);
        } else {
          questionnaire.nextScale();
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipSection = () => {
    questionnaire.clearScaleResponses(currentScaleId);
    if (questionnaire.isLastScale) {
      handleSubmitScale();
    } else {
      questionnaire.nextScale();
    }
  };

  const scalesWithMetadata = currentSession.resolved_scale_ids.map((sid) => {
    const def = scaleDefinitions[sid];
    return {
      scale_id: sid,
      scale_name: def?.name || def?.shortName || sid,
      short_name: def?.shortName || sid,
      description: def?.description,
      instructions:
        def?.instructions ||
        "Under each heading, please tick the ONE box that best describes your health TODAY.",
    };
  });

  return (
    <AssessmentUI
      scales={scalesWithMetadata}
      currentScaleIndex={questionnaire.currentScaleIndex}
      currentQuestionIndex={questionnaire.currentQuestionIndex}
      completedScaleIds={completedScaleIds}
      questions={questions}
      responses={questionnaire.responses}
      totalScales={currentSession.resolved_scale_ids.length}
      isFirstScale={questionnaire.isFirstScale}
      isLastScale={questionnaire.isLastScale}
      questionsAnswered={questionsAnswered}
      onAnswer={handleAnswer}
      onPrev={questionnaire.prevScale}
      onSkipSection={handleSkipSection}
      onSubmitScale={handleSubmitScale}
      onNavigateScale={questionnaire.goToScale}
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
