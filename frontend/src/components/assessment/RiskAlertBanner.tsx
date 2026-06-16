"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { RiskAlert } from "@/types/prs.types";

interface RiskAlertBannerProps {
  alerts: RiskAlert[];
  compact?: boolean;
}

export function RiskAlertBanner({ alerts, compact = false }: RiskAlertBannerProps) {
  if (alerts.length === 0) return null;

  const critical = alerts.filter(a => a.severity === "critical" || a.severity === "high");

  return (
    <div className={cn(
      "rounded-lg border",
      critical.length > 0 ? "bg-danger-50 border-danger-200" : "bg-warning-50 border-warning-500/30"
    )}>
      <div className="px-4 py-3 flex items-start gap-3">
        <ShieldAlert className={cn("h-5 w-5 flex-shrink-0 mt-0.5", critical.length > 0 ? "text-danger-500" : "text-warning-500")} />
        <div className="flex-1">
          <p className="text-sm font-medium text-neutral-900">
            {alerts.length} Risk {alerts.length === 1 ? "Alert" : "Alerts"} Detected
          </p>
          {!compact && (
            <ul className="mt-1.5 space-y-1">
              {alerts.slice(0, 3).map((alert) => (
                <li key={alert.id} className="text-sm text-neutral-700 flex items-start gap-2">
                  <AlertTriangle className={cn("h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                    alert.severity === "critical" ? "text-danger-500" :
                    alert.severity === "high" ? "text-danger-500" :
                    "text-warning-500"
                  )} />
                  {alert.message}
                </li>
              ))}
              {alerts.length > 3 && (
                <li className="text-xs text-neutral-500">+{alerts.length - 3} more</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
