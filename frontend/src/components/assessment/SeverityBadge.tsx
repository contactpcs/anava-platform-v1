import { Badge } from "@/components/ui";

export function SeverityBadge({ level, label }: { level: string; label?: string }) {
  return <Badge variant="severity" severityLevel={level}>{label || level}</Badge>;
}
