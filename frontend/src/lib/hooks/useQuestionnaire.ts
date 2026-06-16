"use client";

import { useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import {
  initQuestionnaire, setAnswer,
  nextQuestion, prevQuestion,
  nextScale, prevScale, goToScale,
  clearScaleResponses,
  toggleVoiceMode, resetQuestionnaire,
} from "@/store/slices/questionnaireSlice";
import { prsService } from "@/lib/api/services";

export function useQuestionnaire() {
  const dispatch = useDispatch<AppDispatch>();
  const state = useSelector((s: RootState) => s.questionnaire);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const init = useCallback((sessionId: string, scaleOrder: string[], existingResponses?: Record<string, Record<string, number | string>>) => {
    dispatch(initQuestionnaire({ sessionId, scaleOrder, existingResponses }));
  }, [dispatch]);

  const answer = useCallback((scaleId: string, questionIndex: number, value: number | string) => {
    dispatch(setAnswer({ scaleId, questionIndex, value }));

    // Debounced auto-save (500ms)
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    if (state.sessionId) {
      autoSaveTimer.current = setTimeout(() => {
        prsService.autoSave(state.sessionId!, scaleId, questionIndex, value).catch(() => {});
      }, 500);
    }
  }, [dispatch, state.sessionId]);

  const submitCurrentScale = useCallback(async () => {
    if (!state.sessionId) return null;
    const scaleId = state.scaleOrder[state.currentScaleIndex];
    const scaleResponses = state.responses[scaleId] || {};
    const result = await prsService.submitResponse(state.sessionId, scaleId, scaleResponses);
    return result;
  }, [state]);

  const currentScaleId = state.scaleOrder[state.currentScaleIndex] || null;
  const currentResponses = currentScaleId ? (state.responses[currentScaleId] || {}) : {};
  const isLastScale = state.currentScaleIndex >= state.scaleOrder.length - 1;
  const isFirstScale = state.currentScaleIndex === 0;

  return {
    ...state,
    currentScaleId,
    currentResponses,
    isLastScale,
    isFirstScale,
    init,
    answer,
    submitCurrentScale,
    nextQuestion: (total: number) => dispatch(nextQuestion({ totalQuestions: total })),
    prevQuestion: () => dispatch(prevQuestion()),
    nextScale: () => dispatch(nextScale()),
    prevScale: () => dispatch(prevScale()),
    goToScale: (idx: number) => dispatch(goToScale(idx)),
    clearScaleResponses: (scaleId: string) => dispatch(clearScaleResponses(scaleId)),
    toggleVoice: () => dispatch(toggleVoiceMode()),
    reset: () => dispatch(resetQuestionnaire()),
  };
}
