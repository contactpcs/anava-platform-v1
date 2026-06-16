"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ClipboardCheck, Activity } from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import { PageLoader, Card, CardContent, Button } from "@/components/ui";
import type { StaffDashboard } from "@/types/domain.types";

export default function CADashboard() {
  const [dashboard, setDashboard] = useState<StaffDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    staffService.getDashboard()
      .then(setDashboard)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <PageLoader />;

  const sessions = dashboard?.upcoming_sessions ?? [];
  const patientCount = dashboard?.patient_count ?? 0;
  const pendingCount = dashboard?.pending_count ?? sessions.filter(s => s.status === "assigned").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <Link href="/clinical-assistant/patients">
          <Button>
            <Users className="h-4 w-4" /> View All Patients
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Patients", value: patientCount, icon: Users, color: "text-primary-500" },
          { label: "Pending", value: pendingCount, icon: ClipboardCheck, color: "text-warning-500" },
          { label: "Upcoming Sessions", value: sessions.length, icon: Activity, color: "text-success-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Upcoming Sessions</h2>
        <Card>
          <div className="divide-y divide-neutral-100">
            {sessions.slice(0, 10).map((s) => (
              <Link key={s.id} href={`/clinical-assistant/sessions/${s.id}`} className="block px-6 py-3 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-neutral-900">
                      {s.title || s.condition_id || "Assessment"}
                    </span>
                    {s.patient_name && (
                      <span className="text-xs text-neutral-500 ml-2">{s.patient_name}</span>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    s.status === "completed" ? "bg-success-500/10 text-success-700" :
                    s.status === "in_progress" ? "bg-warning-50 text-warning-700" :
                    "bg-neutral-100 text-neutral-600"
                  }`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
                {s.due_date && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Due: {new Date(s.due_date).toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
            {sessions.length === 0 && (
              <div className="px-6 py-8 text-center text-neutral-500 text-sm">No upcoming sessions</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
