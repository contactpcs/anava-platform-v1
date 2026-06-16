"use client";

import Link from "next/link";
import { Users, ClipboardCheck, UserPlus, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { useAuth, useStaffDashboard, useStaffPendingPatients, useStaffPatients } from "@/lib/hooks";
import { PageLoader, Card, CardContent, Button } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";

function isSameDay(dateStr?: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  const { dashboard, isLoading: dashLoading } = useStaffDashboard();
  const { pending, isLoading: pendingLoading } = useStaffPendingPatients();
  const { patients, isLoading: patientsLoading } = useStaffPatients();

  // Dashboard stats come from the server, or derive client-side from cached lists.
  const totalPatients = dashboard?.patient_count ?? patients.length;
  const pendingCount  = dashboard?.pending_count ?? pending.length;
  const registeredToday = (() => {
    if (dashboard?.registered_today) return dashboard.registered_today;
    return patients.filter((p) => isSameDay(p.registered_at ?? p.created_at ?? p.assigned_at)).length;
  })();

  const isLoading = dashLoading || pendingLoading || patientsLoading;
  if (isLoading) return <PageLoader />;

  const stats = [
    { label: "Total Patients",    value: totalPatients,  icon: Users,         color: "text-blue-600",  bg: "bg-blue-50",  href: "/receptionist/patients"  },
    { label: "Pending Approvals", value: pendingCount,   icon: ClipboardCheck,color: "text-amber-600", bg: "bg-amber-50", href: "/receptionist/approvals"  },
    { label: "Registered Today",  value: registeredToday,icon: UserPlus,      color: "text-green-600", bg: "bg-green-50", href: "/receptionist/patients"   },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Welcome, {user?.first_name}</h1>
          {user?.clinic_name && (
            <p className="text-xs font-medium text-blue-600 mt-0.5">{user.clinic_name}</p>
          )}
          <p className="text-sm text-neutral-500 mt-0.5">Here&apos;s what needs your attention today.</p>
        </div>
        <Link href="/receptionist/approvals">
          <Button><ClipboardCheck className="h-4 w-4 mr-1.5" />Pending Approvals</Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl ${s.bg} flex items-center justify-center ${s.color} flex-shrink-0`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
                  <p className="text-xs text-neutral-500 leading-tight">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Pending registrations preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
            Pending Self-Registrations
          </h2>
          {pending.length > 0 && (
            <Link href="/receptionist/approvals" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <Card>
          <div className="divide-y divide-neutral-100">
            {pending.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                  {(p.first_name?.[0] || p.full_name?.[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown"}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{p.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    <Clock className="h-3 w-3" />Pending
                  </span>
                  <Link href="/receptionist/approvals" className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    Review
                  </Link>
                </div>
              </div>
            ))}

            {pending.length === 0 && (
              <div className="px-6 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-600">All caught up!</p>
                <p className="text-xs text-neutral-400 mt-0.5">No pending registrations at the moment.</p>
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}

