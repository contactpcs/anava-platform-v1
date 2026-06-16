import { cn } from "@/lib/utils/cn";
import { getSeverityBgColor } from "@/lib/utils/format";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "severity";
  severityLevel?: string;
  className?: string;
}

export function Badge({ children, variant = "default", severityLevel, className }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const colors = variant === "severity" && severityLevel
    ? getSeverityBgColor(severityLevel)
    : "bg-primary-100 text-primary-800";

  return <span className={cn(base, colors, className)}>{children}</span>;
}
