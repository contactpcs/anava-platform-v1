"use client";

import { Mic, MicOff, Volume2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { STTPhase } from "@/lib/hooks/useAssessmentSTT";

interface STTBarProps {
  phase: STTPhase;
  transcript: string;
  matchedLabel: string | null;
  hint: string | null;
}

export function STTBar({ phase, transcript, matchedLabel, hint }: STTBarProps) {
  return (
    <div
      className={cn(
        "border-b px-6 py-2.5 flex items-center gap-3 text-sm transition-colors",
        phase === "listening" && "bg-red-50 border-red-100",
        phase === "reading" && "bg-blue-50 border-blue-100",
        phase === "matched" && "bg-green-50 border-green-100",
        phase === "error" && "bg-orange-50 border-orange-100",
        phase === "idle" && "bg-neutral-50 border-neutral-100",
      )}
    >
      {/* Phase icon */}
      {phase === "reading" && (
        <Volume2 className="h-4 w-4 text-blue-500 animate-pulse shrink-0" />
      )}
      {phase === "listening" && (
        <span className="relative shrink-0">
          <Mic className="h-4 w-4 text-red-500" />
          <span className="absolute -inset-1 rounded-full bg-red-400 opacity-30 animate-ping" />
        </span>
      )}
      {phase === "matched" && (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      )}
      {phase === "error" && (
        <AlertCircle className="h-4 w-4 text-orange-500 shrink-0" />
      )}
      {phase === "idle" && (
        <MicOff className="h-4 w-4 text-neutral-400 shrink-0" />
      )}

      {/* Status text */}
      <span
        className={cn(
          "flex-1 truncate",
          phase === "listening" && "text-red-700",
          phase === "reading" && "text-blue-700",
          phase === "matched" && "text-green-700",
          phase === "error" && "text-orange-700",
          phase === "idle" && "text-neutral-500",
        )}
      >
        {phase === "idle" && "Voice mode ready — enable mic to start"}
        {phase === "reading" && "Reading question aloud…"}
        {phase === "listening" &&
          (transcript ? (
            <>Heard: <strong>&ldquo;{transcript}&rdquo;</strong></>
          ) : (
            "Listening… speak your answer"
          ))}
        {phase === "matched" && (
          <>
            Selected: <strong>&ldquo;{matchedLabel}&rdquo;</strong> — moving to next question
          </>
        )}
        {phase === "error" && (hint ?? "Microphone error")}
      </span>

      {/* Retry hint */}
      {hint && phase === "listening" && (
        <span className="text-xs text-red-500 shrink-0">{hint}</span>
      )}
    </div>
  );
}
