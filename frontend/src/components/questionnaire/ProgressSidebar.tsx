"use client";

import { cn } from "@/lib/utils/cn";
import { Check } from "lucide-react";

interface ProgressSidebarProps {
  scales: Array<{ scale_id: string; short_name: string; scale_name?: string }>;
  currentIndex: number;
  completedScaleIds: Set<string>;
  responses: Record<string, Record<string, number | string>>;
  onNavigate: (index: number) => void;
  overallProgress?: number;
}

export function ProgressSidebar({
  scales,
  currentIndex,
  completedScaleIds,
  responses,
  onNavigate,
  overallProgress = 0,
}: ProgressSidebarProps) {
  return (
    <div className="w-56 bg-white border-r border-neutral-200 flex flex-col overflow-hidden flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
          PROGRESS
        </span>
        <div className="relative w-9 h-9">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="2.5"
            />
            <circle
              cx="18"
              cy="18"
              r="15.915"
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeDasharray={`${overallProgress} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-neutral-700">
            {overallProgress}%
          </span>
        </div>
      </div>

      {/* Scale List */}
      <div className="flex-1 overflow-y-auto py-2">
        {scales.map((scale, idx) => {
          const isActive = idx === currentIndex;
          const isComplete = completedScaleIds.has(scale.scale_id);
          const hasResponses = Object.keys(responses[scale.scale_id] || {}).length > 0;

          return (
            <button
              key={scale.scale_id}
              onClick={() => onNavigate(idx)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-left transition-all border-r-2",
                isActive
                  ? "bg-orange-50 border-r-orange-500"
                  : "border-r-transparent hover:bg-neutral-50",
              )}
            >
              <div
                className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                  isComplete && "bg-green-100 text-green-700",
                  isActive && !isComplete && "bg-orange-500 text-white",
                  !isActive && !isComplete && hasResponses && "bg-amber-100 text-amber-700",
                  !isActive && !isComplete && !hasResponses && "bg-neutral-100 text-neutral-500",
                )}
              >
                {isComplete ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-xs font-semibold truncate",
                    isActive
                      ? "text-orange-700"
                      : isComplete
                        ? "text-green-700"
                        : "text-neutral-700",
                  )}
                >
                  {scale.short_name}
                </p>
                {scale.scale_name && (
                  <p className="text-xs text-neutral-400 truncate">{scale.scale_name}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
