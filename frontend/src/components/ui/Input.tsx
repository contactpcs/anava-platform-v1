"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-neutral-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={cn(
          "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-neutral-900 transition-all duration-150",
          "placeholder:text-neutral-400",
          "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
          "hover:border-neutral-400",
          error
            ? "border-danger-400 focus:ring-danger-500/20 focus:border-danger-500"
            : "border-neutral-300",
          className
        )}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-danger-600 flex items-center gap-1">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
);
Input.displayName = "Input";

export { Input };
