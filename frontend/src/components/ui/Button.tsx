"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:   "bg-brand-gradient text-white shadow-sm hover:opacity-90 focus:ring-primary-500/40",
        secondary: "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 focus:ring-neutral-400/30",
        outline:   "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 focus:ring-neutral-400/30",
        ghost:     "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus:ring-neutral-400/30",
        danger:    "bg-danger-500 text-white shadow-sm hover:bg-danger-700 focus:ring-danger-500/40",
        success:   "bg-success-500 text-white shadow-sm hover:bg-success-700 focus:ring-success-500/40",
      },
      size: {
        sm:   "h-8 px-3 text-xs gap-1.5",
        md:   "h-10 px-4 text-sm gap-2",
        lg:   "h-11 px-6 text-sm gap-2",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
