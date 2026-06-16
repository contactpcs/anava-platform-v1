"use client";

interface TimeInputProps {
  value: string | undefined;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export function TimeInput({ value, onChange, readOnly }: TimeInputProps) {
  return (
    <div className="max-w-xs">
      <input
        type="time"
        value={value ?? ""}
        onChange={(e) => !readOnly && onChange(e.target.value)}
        disabled={readOnly}
        className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
      />
    </div>
  );
}
