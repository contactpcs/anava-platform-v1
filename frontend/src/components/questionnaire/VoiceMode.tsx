"use client";

import { useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui";
import { useVoiceMode } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";

interface VoiceModeProps {
  questionText: string;
  options?: Array<{ value: number; label: string }>;
  onAnswer: (value: number | string) => void;
  isActive: boolean;
}

export function VoiceMode({ questionText, options, onAnswer, isActive }: VoiceModeProps) {
  const {
    isListening, isReading, transcript, error, isSupported,
    startListening, stopListening, speak, stopSpeaking,
  } = useVoiceMode({
    onTranscript: (text) => {
      if (!options) return;
      const lower = text.toLowerCase().trim();
      const words = lower.split(/\s+/);

      // Word → 1-based display index (matches what LikertInput displays as "(1)", "(2)", …)
      const indexMap: Record<string, number> = {
        one: 1,   first: 1,
        two: 2,   second: 2,
        three: 3, third: 3,
        four: 4,  fourth: 4,
        five: 5,  fifth: 5,
        six: 6,   sixth: 6,
        seven: 7, seventh: 7,
        eight: 8, eighth: 8,
        nine: 9,  ninth: 9,
      };

      // 1. Spoken number or word → 1-based display index (say "1" → first option)
      for (const word of words) {
        const digit = parseInt(word, 10);
        if (!isNaN(digit) && digit >= 1 && digit <= options.length) {
          onAnswer(options[digit - 1].value);
          return;
        }
        if (indexMap[word] !== undefined) {
          const idx = indexMap[word];
          if (idx >= 1 && idx <= options.length) { onAnswer(options[idx - 1].value); return; }
        }
      }

      // 2. Exact label match
      for (const opt of options) {
        if (lower === opt.label.toLowerCase()) { onAnswer(opt.value); return; }
      }

      // 3. Transcript contains full label
      for (const opt of options) {
        if (lower.includes(opt.label.toLowerCase())) { onAnswer(opt.value); return; }
      }

      // 4. First significant word (≥4 chars) of label appears in transcript
      for (const opt of options) {
        const sig = opt.label.toLowerCase().split(/\s+/).find(w => w.length >= 4);
        if (sig && lower.includes(sig)) { onAnswer(opt.value); return; }
      }
    },
  });

  useEffect(() => {
    if (isActive && questionText) {
      const timer = setTimeout(() => speak(questionText), 300);
      return () => clearTimeout(timer);
    }
  }, [questionText, isActive]);

  if (!isSupported) {
    return (
      <div className="bg-warning-50 text-warning-700 px-4 py-3 rounded-lg text-sm">
        Voice mode is not supported in this browser. Please use Chrome or Edge.
      </div>
    );
  }

  return (
    <div className="bg-primary-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-700">Voice Mode Active</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isReading ? "danger" : "outline"}
            onClick={isReading ? stopSpeaking : () => speak(questionText)}
          >
            {isReading ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {isReading ? "Stop" : "Read"}
          </Button>
          <Button
            size="sm"
            variant={isListening ? "danger" : "primary"}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? "Stop" : "Speak"}
          </Button>
        </div>
      </div>

      {options && options.length > 0 && !isListening && !transcript && (
        <p className="text-xs text-primary-600/70">
          Say the option number (1, 2, 3…) or part of the option text.
        </p>
      )}

      {isListening && (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-danger-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-sm text-neutral-600">Listening…</span>
        </div>
      )}

      {transcript && (
        <div className="bg-white rounded-lg px-3 py-2 text-sm text-neutral-700">
          Heard: &ldquo;{transcript}&rdquo;
        </div>
      )}

      {error && (
        <div className="text-xs text-danger-500">Error: {error}</div>
      )}
    </div>
  );
}
