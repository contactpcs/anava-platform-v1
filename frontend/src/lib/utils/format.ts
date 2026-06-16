export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatScore(score: number, maxScore: number): string {
  return `${score}/${maxScore}`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function getSeverityColor(level: string): string {
  const colors: Record<string, string> = {
    minimal: "text-severity-minimal",
    normal: "text-severity-normal",
    mild: "text-severity-mild",
    moderate: "text-severity-moderate",
    "moderately-severe": "text-severity-moderately-severe",
    severe: "text-severity-severe",
    "extremely-severe": "text-severity-extremely-severe",
    critical: "text-severity-critical",
  };
  return colors[level] || "text-neutral-500";
}

export function getSeverityBgColor(level: string): string {
  const colors: Record<string, string> = {
    minimal: "bg-green-100 text-green-800",
    normal: "bg-green-100 text-green-800",
    mild: "bg-lime-100 text-lime-800",
    moderate: "bg-amber-100 text-amber-800",
    "moderately-severe": "bg-orange-100 text-orange-800",
    severe: "bg-red-100 text-red-800",
    "extremely-severe": "bg-red-200 text-red-900",
    critical: "bg-red-300 text-red-950",
  };
  return colors[level] || "bg-neutral-100 text-neutral-800";
}
