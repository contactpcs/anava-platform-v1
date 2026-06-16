"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { UserCheck, Send, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { useQuestionnaire, useSessions } from "@/lib/hooks";
import { prsService } from "@/lib/api/services";
import { PageLoader, Button, ProgressBar, Card, CardContent } from "@/components/ui";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import type { ScaleDefinition } from "@/types/prs.types";

export default function ConductAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentSession, loadSession } = useSessions();
  const questionnaire = useQuestionnaire();
  const [scaleDefinitions, setScaleDefinitions] = useState<Record<string, ScaleDefinition>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { loadSession(id); }, [id, loadSession]);

  useEffect(() => {
    if (currentSession && !questionnaire.sessionId) {
      const existing: Record<string, Record<string, number | string>> = {};
      const completed = new Set<string>();
      currentSession.scale_responses?.forEach((r) => {
        if (r.responses) existing[r.scale_id] = r.responses;
        if (r.status === "completed" || r.status === "clinician_completed") completed.add(r.scale_id);
      });
      setCompletedScaleIds(completed);
      questionnaire.init(id, currentSession.resolved_scale_ids, existing);
      if (currentSession.status === "assigned") prsService.startSession(id);
    }
  }, [currentSession]);

  useEffect(() => {
    if (!questionnaire.currentScaleId || scaleDefinitions[questionnaire.currentScaleId]) return;
    prsService.getScale(questionnaire.currentScaleId).then((scale) => {
      setScaleDefinitions((prev) => ({ ...prev, [questionnaire.currentScaleId!]: (scale as any).definition || scale }));
    });
  }, [questionnaire.currentScaleId]);

  if (!currentSession || !questionnaire.currentScaleId) return <PageLoader />;
  const currentDef = scaleDefinitions[questionnaire.currentScaleId];
  if (!currentDef) return <PageLoader />;

  const questions = currentDef.questions || [];
  const currentQuestion = questions[questionnaire.currentQuestionIndex];
  const totalQuestions = questions.length;
  const currentValue = questionnaire.currentResponses[String(questionnaire.currentQuestionIndex)];
  const isLastQuestion = questionnaire.currentQuestionIndex >= totalQuestions - 1;

  const handleAnswer = (qIdx: number, value: number | string) => {
    questionnaire.answer(questionnaire.currentScaleId!, qIdx, value);
  };

  const handleSubmitScale = async () => {
    setIsSubmitting(true);
    try {
      const scaleId = questionnaire.currentScaleId!;
      const responses = questionnaire.responses[scaleId] || {};
      const isClinician = currentDef.scoringType === "clinician" || (currentDef as any).isClinicianRated;

      if (isClinician) {
        await prsService.submitClinicianRating(id, scaleId, responses);
      } else {
        await prsService.submitResponse(id, scaleId, responses);
      }

      const newCompleted = new Set(completedScaleIds).add(scaleId);
      setCompletedScaleIds(newCompleted);
      if (questionnaire.isLastScale) {
        const skippedIds = currentSession.resolved_scale_ids.filter(
          (sid) => !newCompleted.has(sid)
        );
        await Promise.all(
          skippedIds.map((sid) => prsService.submitResponse(id, sid, {}))
        );
        router.push(`/doctor/sessions/${id}`);
      } else {
        questionnaire.nextScale();
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipSection = () => {
    questionnaire.clearScaleResponses(questionnaire.currentScaleId!);
    if (questionnaire.isLastScale) {
      handleSubmitScale();
    } else {
      questionnaire.nextScale();
    }
  };

  const scaleList = currentSession.resolved_scale_ids.map((sid) => ({
    scale_id: sid,
    short_name: scaleDefinitions[sid]?.shortName || sid,
  }));

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mb-6">
      <ProgressSidebar scales={scaleList} currentIndex={questionnaire.currentScaleIndex} completedScaleIds={completedScaleIds} responses={questionnaire.responses} onNavigate={questionnaire.goToScale} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with clinician badge */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 bg-accent/10 text-accent rounded-full text-xs font-medium flex items-center gap-1">
                <UserCheck className="h-3.5 w-3.5" /> Clinician Administered
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">{currentDef.shortName}</h2>
            </div>
            <ProgressBar value={questionnaire.currentQuestionIndex + 1} max={totalQuestions} className="w-32" />
          </div>
          <p className="text-sm text-neutral-500 mt-1">Read the question aloud, record the patient&apos;s answer</p>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {currentQuestion && (
              <QuestionRenderer question={currentQuestion} scaleId={questionnaire.currentScaleId!} value={currentValue} onAnswer={handleAnswer} questionNumber={questionnaire.currentQuestionIndex + 1} totalQuestions={totalQuestions} />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
          <Button variant="outline" onClick={questionnaire.currentQuestionIndex > 0 ? questionnaire.prevQuestion : questionnaire.prevScale} disabled={questionnaire.isFirstScale && questionnaire.currentQuestionIndex === 0}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSkipSection}>
              <SkipForward className="h-4 w-4" />
              Skip Section
            </Button>
            {isLastQuestion ? (
              <Button onClick={handleSubmitScale} isLoading={isSubmitting}>
                <Send className="h-4 w-4" /> {questionnaire.isLastScale ? "Submit Assessment" : "Submit & Next Scale"}
              </Button>
            ) : (
              <Button onClick={() => questionnaire.nextQuestion(totalQuestions)} disabled={currentValue === undefined}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
