"use client";

interface TextInputProps {
  value: string | undefined;
  onChange: (val: string) => void;
  readOnly?: boolean;
}

export function TextInput({ value, onChange, readOnly }: TextInputProps) {
  return (
    <textarea
      value={value ?? ""}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      disabled={readOnly}
      rows={3}
      placeholder="Type your response..."
      className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
    />
  );
}
