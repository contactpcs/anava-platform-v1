"use client";

import type { QuestionOption } from "@/types/prs.types";
import { LikertInput } from "./LikertInput";

interface NumericInputProps {
  min?: number;
  max?: number;
  value: number | undefined;
  onChange: (val: number) => void;
  options?: QuestionOption[];
  readOnly?: boolean;
}

export function NumericInput({ min, max, value, onChange, options, readOnly }: NumericInputProps) {
  if (options && options.length > 0) {
    return <LikertInput options={options} value={value} onChange={onChange} readOnly={readOnly} />;
  }

  return (
    <div className="max-w-xs">
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => !readOnly && onChange(Number(e.target.value))}
        disabled={readOnly}
        placeholder={`Enter a number${min !== undefined ? ` (${min}` : ""}${max !== undefined ? `-${max})` : ")"}`}
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
      />
    </div>
  );
}
