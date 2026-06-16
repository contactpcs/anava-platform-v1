"use client";

interface VASSliderProps {
  min: number;
  max: number;
  step: number;
  value: number | undefined;
  onChange: (val: number) => void;
  readOnly?: boolean;
}

export function VASSlider({ min, max, step, value, onChange, readOnly }: VASSliderProps) {
  const current = value ?? min;
  const pct = ((current - min) / (max - min)) * 100;

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          onChange={(e) => !readOnly && onChange(Number(e.target.value))}
          disabled={readOnly}
          className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        <div className="flex justify-between mt-2">
          <span className="text-xs text-neutral-500">{min}</span>
          <span className="text-xs text-neutral-500">{max}</span>
        </div>
      </div>
      <div className="text-center">
        <span className="text-3xl font-bold text-primary-600">{current}</span>
        <span className="text-sm text-neutral-500 ml-1">/ {max}</span>
      </div>
    </div>
  );
}
