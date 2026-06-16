"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScaleQuestion } from "@/types/prs.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type STTPhase = "idle" | "reading" | "listening" | "matched" | "error";

export interface AssessmentSTTState {
  phase: STTPhase;
  transcript: string;
  matchedLabel: string | null;
  hint: string | null;          // "didn't understand, try again" etc.
  isSupported: boolean;
}

export interface UseAssessmentSTTOptions {
  /** Unique key that changes whenever the active question changes (e.g. `"${scaleIdx}-${qIdx}"`) */
  questionKey: string;
  question: ScaleQuestion | undefined;
  enabled: boolean;
  onAnswer: (questionIndex: number, value: number | string) => void;
  onAutoAdvance: () => void;
}

// ─── Matching logic ───────────────────────────────────────────────────────────

// Word → 1-based display index (matches the "(1)", "(2)"… labels shown in LikertInput)
const WORD_TO_INDEX: Record<string, number> = {
  one: 1,   first: 1,
  two: 2,   second: 2,
  three: 3, third: 3,
  four: 4,  fourth: 4,
  five: 5,  fifth: 5,
  six: 6,   sixth: 6,
  seven: 7, seventh: 7,
  eight: 8, eighth: 8,
  nine: 9,  ninth: 9,
  ten: 10,  tenth: 10,
};

function matchTranscript(
  raw: string,
  question: ScaleQuestion,
): { value: number | string; label: string } | null {
  const lower = raw.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // ─── Likert / radio / checkbox ──────────────────────────────────────────
  if (question.options?.length) {
    // 1. Spoken number or word → 1-based display index (say "1" → first option)
    for (const word of words) {
      const digit = parseInt(word, 10);
      if (!isNaN(digit) && digit >= 1 && digit <= question.options.length) {
        const opt = question.options[digit - 1];
        return { value: opt.value, label: opt.label };
      }
      if (WORD_TO_INDEX[word] !== undefined) {
        const idx = WORD_TO_INDEX[word];
        if (idx >= 1 && idx <= question.options.length) {
          const opt = question.options[idx - 1];
          return { value: opt.value, label: opt.label };
        }
      }
    }

    // 2. Exact full label
    for (const opt of question.options) {
      if (lower === opt.label.toLowerCase()) return { value: opt.value, label: opt.label };
    }

    // 3. Label substring (whole transcript contains the label)
    for (const opt of question.options) {
      if (lower.includes(opt.label.toLowerCase())) return { value: opt.value, label: opt.label };
    }

    // 4. First significant word of label (≥4 chars) appears in transcript
    for (const opt of question.options) {
      const sig = opt.label
        .toLowerCase()
        .split(/\s+/)
        .find((w) => w.length >= 4);
      if (sig && lower.includes(sig)) return { value: opt.value, label: opt.label };
    }

    return null;
  }

  // ─── Numeric / slider ───────────────────────────────────────────────────
  if (question.type === "numeric" || question.type === "vas" || question.type === "nrs") {
    for (const word of words) {
      const num = parseFloat(word);
      if (!isNaN(num)) return { value: num, label: String(num) };
      if (WORD_TO_INDEX[word] !== undefined)
        return { value: WORD_TO_INDEX[word], label: String(WORD_TO_INDEX[word]) };
    }
    return null;
  }

  // ─── Free text ──────────────────────────────────────────────────────────
  if (question.type === "text") {
    const trimmed = raw.trim();
    return trimmed ? { value: trimmed, label: trimmed } : null;
  }

  return null;
}

function buildReadAloudText(question: ScaleQuestion): string {
  let text = question.label;

  if (question.options?.length) {
    const optionLines = question.options
      .map((opt, i) => `${i + 1}: ${opt.label}`)
      .join(". ");
    text += `. Options are: ${optionLines}.`;
  } else if (
    (question.type === "vas" || question.type === "nrs" || question.type === "numeric") &&
    question.min != null && question.max != null
  ) {
    text += ` Enter a number between ${question.min} and ${question.max}.`;
  }

  return text;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAssessmentSTT({
  questionKey,
  question,
  enabled,
  onAnswer,
  onAutoAdvance,
}: UseAssessmentSTTOptions): AssessmentSTTState & { stopAll: () => void } {
  const [phase, setPhase] = useState<STTPhase>("idle");
  const [transcript, setTranscript] = useState("");
  const [matchedLabel, setMatchedLabel] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // Stable refs so callbacks never go stale
  const phaseRef = useRef<STTPhase>("idle");
  const enabledRef = useRef(enabled);
  const questionRef = useRef(question);
  const onAnswerRef = useRef(onAnswer);
  const onAutoAdvanceRef = useRef(onAutoAdvance);
  const recRef = useRef<any>(null);
  const recRunning = useRef(false);
  const advTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { questionRef.current = question; }, [question]);
  useEffect(() => { onAnswerRef.current = onAnswer; }, [onAnswer]);
  useEffect(() => { onAutoAdvanceRef.current = onAutoAdvance; }, [onAutoAdvance]);

  const isSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const setPhaseAll = (p: STTPhase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const stopRec = useCallback(() => {
    if (recRef.current && recRunning.current) {
      try { recRef.current.stop(); } catch {}
    }
  }, []);

  const stopAll = useCallback(() => {
    clearTimeout(advTimerRef.current);
    clearTimeout(retryTimerRef.current);
    stopRec();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPhaseAll("idle");
    setTranscript("");
    setMatchedLabel(null);
    setHint(null);
  }, [stopRec]);

  // ─── One-time recognition setup ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => { recRunning.current = true; };

    rec.onresult = (event: any) => {
      let interim = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }

      const heard = (finalText || interim).trim();
      if (heard) setTranscript(heard);

      if (phaseRef.current !== "listening") return;

      const q = questionRef.current;
      if (!q) return;

      // Try matching against final text first, then fall back to interim.
      // Many browsers with continuous:true are slow to emit isFinal — matching
      // interim lets us respond immediately when the answer is clear.
      const textToMatch = (finalText || interim).trim();
      if (!textToMatch) return;

      const match = matchTranscript(textToMatch, q);
      if (match) {
        // ── Matched ───────────────────────────────────────────────────────
        setPhaseAll("matched");
        setMatchedLabel(match.label);
        setHint(null);
        stopRec();
        onAnswerRef.current(q.index, match.value);

        clearTimeout(advTimerRef.current);
        advTimerRef.current = setTimeout(() => {
          if (enabledRef.current) onAutoAdvanceRef.current();
        }, 900);
      } else if (finalText) {
        // Only show "didn't catch that" hint on a completed (final) utterance
        setHint("Didn't catch that — try again");
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => setHint(null), 2000);
      }
    };

    rec.onerror = (event: any) => {
      const error = (event as any).error;
      // Transient errors — let onend restart automatically
      if (error === "no-speech" || error === "network" || error === "aborted") return;
      setPhaseAll("error");
      setHint(error ?? "Microphone error");
    };

    rec.onend = () => {
      recRunning.current = false;
      // Auto-restart if still in listening phase (handles transient network errors too)
      if (phaseRef.current === "listening" && enabledRef.current) {
        try { rec.start(); } catch {}
      }
    };

    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Main cycle: fires when question or enabled changes ────────────────
  useEffect(() => {
    clearTimeout(advTimerRef.current);
    clearTimeout(retryTimerRef.current);
    stopRec();
    window.speechSynthesis?.cancel();
    setTranscript("");
    setMatchedLabel(null);
    setHint(null);

    if (!enabled || !question) {
      setPhaseAll("idle");
      return;
    }

    // Read question aloud, then start listening
    setPhaseAll("reading");
    const text = buildReadAloudText(question);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.92;

    utterance.onend = () => {
      if (!enabledRef.current || phaseRef.current !== "reading") return;
      setPhaseAll("listening");
      setTranscript("");
      if (recRef.current && !recRunning.current) {
        try { recRef.current.start(); } catch {}
      }
    };

    utterance.onerror = () => {
      // TTS failed — skip straight to listening
      if (!enabledRef.current) return;
      setPhaseAll("listening");
      if (recRef.current && !recRunning.current) {
        try { recRef.current.start(); } catch {}
      }
    };

    window.speechSynthesis.speak(utterance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey, enabled]);

  return { phase, transcript, matchedLabel, hint, isSupported, stopAll };
}
