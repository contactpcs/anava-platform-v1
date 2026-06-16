"use client";

import { cn } from "@/lib/utils/cn";
import type { QuestionOption } from "@/types/prs.types";

interface LikertInputProps {
  options: QuestionOption[];
  value: number | undefined;
  onChange: (val: number) => void;
  readOnly?: boolean;
}

const GRID_COLS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

export function LikertInput({ options, value, onChange, readOnly }: LikertInputProps) {
  const useHorizontal = options.length >= 2 && options.length <= 5;

  if (useHorizontal) {
    const gridClass = GRID_COLS[options.length] ?? "grid-cols-5";
    return (
      <div className={cn("grid gap-2", gridClass)}>
        {options.map((opt, i) => {
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !readOnly && onChange(opt.value)}
              disabled={readOnly}
              className={cn(
                "flex flex-col items-center justify-between p-3 rounded-lg border-2 text-center transition-all min-h-[72px] gap-1.5",
                isSelected
                  ? "border-orange-500 bg-orange-50"
                  : "border-neutral-200 bg-white hover:border-orange-300 hover:bg-orange-50/40",
                readOnly && "cursor-default opacity-75",
              )}
            >
              <span
                className={cn(
                  "text-xs leading-snug flex-1 flex items-center justify-center text-center",
                  isSelected ? "text-orange-900 font-medium" : "text-neutral-700",
                )}
              >
                {opt.label}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold",
                  isSelected ? "text-orange-500" : "text-neutral-400",
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // Vertical list for 6+ options
  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const isSelected = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => !readOnly && onChange(opt.value)}
            disabled={readOnly}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all",
              isSelected
                ? "border-orange-500 bg-orange-50 ring-2 ring-orange-200"
                : "border-neutral-200 hover:border-orange-300 hover:bg-neutral-50",
              readOnly && "cursor-default opacity-75",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                isSelected ? "border-orange-500" : "border-neutral-300",
              )}
            >
              {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />}
            </div>
            <span
              className={cn(
                "text-sm flex-1",
                isSelected ? "text-orange-900 font-medium" : "text-neutral-700",
              )}
            >
              {opt.label}
            </span>
            <span className="text-xs text-neutral-400 flex-shrink-0">({i + 1})</span>
          </button>
        );
      })}
    </div>
  );
}
