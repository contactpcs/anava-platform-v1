"use client";

import { useState } from "react";
import { AlertTriangle, Check, Shield } from "lucide-react";
import { prsService } from "@/lib/api/services";
import { useAuth } from "@/lib/hooks";
import { useMyAlerts } from "@/lib/hooks";
import { PageLoader, Button, Card, CardContent, Modal } from "@/components/ui";
import { SeverityBadge } from "@/components/assessment";
import { formatDateTime } from "@/lib/utils/format";
import type { RiskAlert } from "@/types/prs.types";

export default function AlertsPage() {
  const { isDoctor } = useAuth();
  const { alerts, isLoading } = useMyAlerts();
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");

  const handleAcknowledge = async (alertId: string) => {
    await prsService.acknowledgeAlert(alertId);
  };

  const handleResolve = async () => {
    if (!resolveId || !resolveNotes) return;
    await prsService.resolveAlert(resolveId, resolveNotes);
    setResolveId(null);
    setResolveNotes("");
  };

  if (isLoading) return <PageLoader />;

  const active = alerts.filter(a => a.status === "active");
  const acknowledged = alerts.filter(a => a.status === "acknowledged");
  const resolved = alerts.filter(a => a.status === "resolved");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Risk Alerts</h1>

      {active.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-danger-500 uppercase tracking-wide mb-3">Active ({active.length})</h2>
          <div className="space-y-3">
            {active.map((alert) => (
              <Card key={alert.id} className="border-danger-200">
                <CardContent className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-danger-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2">
                        <SeverityBadge level={alert.severity} />
                        <span className="text-xs text-neutral-500">{formatDateTime(alert.created_at)}</span>
                      </div>
                      <p className="text-sm text-neutral-800 mt-1">{alert.message}</p>
                      {alert.source_scale_id && (
                        <p className="text-xs text-neutral-500 mt-1">Scale: {alert.source_scale_id}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => handleAcknowledge(alert.id)}>
                      <Check className="h-3.5 w-3.5" /> Acknowledge
                    </Button>
                    {isDoctor && (
                      <Button size="sm" variant="success" onClick={() => setResolveId(alert.id)}>
                        <Shield className="h-3.5 w-3.5" /> Resolve
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {acknowledged.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-warning-500 uppercase tracking-wide mb-3">Acknowledged ({acknowledged.length})</h2>
          <div className="space-y-3">
            {acknowledged.map((alert) => (
              <Card key={alert.id}>
                <CardContent className="flex items-start justify-between">
                  <div>
                    <SeverityBadge level={alert.severity} />
                    <p className="text-sm text-neutral-700 mt-1">{alert.message}</p>
                  </div>
                  {isDoctor && (
                    <Button size="sm" variant="success" onClick={() => setResolveId(alert.id)}>Resolve</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-success-500 uppercase tracking-wide mb-3">Resolved ({resolved.length})</h2>
          <div className="space-y-2 opacity-60">
            {resolved.slice(0, 5).map((alert) => (
              <Card key={alert.id}>
                <CardContent>
                  <p className="text-sm text-neutral-600">{alert.message}</p>
                  <p className="text-xs text-neutral-400 mt-1">Resolved: {alert.resolution_notes}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Modal isOpen={!!resolveId} onClose={() => setResolveId(null)} title="Resolve Alert">
        <textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} rows={3} placeholder="Enter resolution notes..." className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-primary-500 outline-none" />
        <Button onClick={handleResolve} disabled={!resolveNotes} className="w-full">Resolve</Button>
      </Modal>
    </div>
  );
}
