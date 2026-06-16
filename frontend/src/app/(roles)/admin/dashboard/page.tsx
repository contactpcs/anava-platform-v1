"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  Building2, UserCog, Users, ClipboardCheck, Activity,
  Stethoscope, UserCheck, ArrowRight, Bell, Plus, RefreshCw,
  TrendingUp, Clock,
} from "lucide-react";
import { useAuth, useAdminDashboard, useNotifications } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton } from "@/components/ui";
import type { ClinicBreakdown } from "@/types/admin.types";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4 space-y-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="bg-white rounded-xl border border-neutral-200/80">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20 ml-auto" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <div className="bg-white rounded-xl border border-neutral-200/80 p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const { dashboard, isLoading, error, fetch } = useAdminDashboard();
  const { notifications, unreadCount } = useNotifications();

  useEffect(() => {
    fetch();
  }, [fetch]);

  if (isLoading) return <DashboardSkeleton />;

  // API response shape: { stats: { total_clinics, ... }, clinic_breakdown: [...] }
  const s = dashboard?.stats;

  const stats = [
    { label: "Clinics",             value: s?.total_clinics             ?? 0, icon: Building2,      color: "text-indigo-600", bg: "bg-indigo-50",  href: "/admin/clinics"  },
    { label: "Doctors",             value: s?.total_doctors             ?? 0, icon: Stethoscope,    color: "text-blue-600",   bg: "bg-blue-50",    href: "/admin/staff"    },
    { label: "Receptionists",       value: s?.total_receptionists       ?? 0, icon: UserCog,        color: "text-cyan-600",   bg: "bg-cyan-50",    href: "/admin/staff"    },
    { label: "Clinical Assistants", value: s?.total_clinical_assistants ?? 0, icon: ClipboardCheck, color: "text-teal-600",   bg: "bg-teal-50",    href: "/admin/staff"    },
    { label: "Patients",            value: s?.total_patients            ?? 0, icon: Users,          color: "text-green-600",  bg: "bg-green-50",   href: "/admin/patients" },
    { label: "Pending Approvals",   value: s?.pending_approvals         ?? 0, icon: Clock,          color: "text-amber-600",  bg: "bg-amber-50",   href: "/admin/patients" },
    { label: "Active Assessments",  value: s?.active_assessments        ?? 0, icon: TrendingUp,     color: "text-rose-600",   bg: "bg-rose-50",    href: "/admin/dashboard" },
  ];

  const clinicBreakdown: ClinicBreakdown[] = dashboard?.clinic_breakdown ?? [];
  const recentNotifications = notifications.slice(0, 5);
  const pendingApprovals = s?.pending_approvals ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Welcome back, {user?.first_name}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Platform overview — all clinics and operations at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link href="/admin/clinics">
            <Button><Plus className="h-4 w-4 mr-1.5" />New Clinic</Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="py-4 px-4">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color} mb-3`}>
                  <s.icon className="h-4 w-4" />
                </div>
                <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
                <p className="text-[11px] text-neutral-500 leading-tight mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Add Clinic",    href: "/admin/clinics",   icon: Building2, color: "text-indigo-600", bg: "bg-indigo-50 hover:bg-indigo-100" },
          { label: "Add Staff",     href: "/admin/staff",     icon: UserCog,   color: "text-purple-600", bg: "bg-purple-50 hover:bg-purple-100" },
          { label: "Approvals",     href: "/admin/patients",  icon: UserCheck, color: "text-amber-600",  bg: "bg-amber-50 hover:bg-amber-100"   },
          { label: "Notifications", href: "/admin/dashboard", icon: Bell,      color: "text-blue-600",   bg: "bg-blue-50 hover:bg-blue-100"     },
        ].map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-neutral-200/80 ${a.bg} transition-colors`}
          >
            <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center ${a.color} flex-shrink-0 shadow-sm`}>
              <a.icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-neutral-700">{a.label}</span>
            {a.label === "Notifications" && unreadCount > 0 && (
              <span className="ml-auto text-xs font-semibold text-white bg-red-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unreadCount}
              </span>
            )}
            {a.label === "Approvals" && pendingApprovals > 0 && (
              <span className="ml-auto text-xs font-semibold text-white bg-amber-500 rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {pendingApprovals}
              </span>
            )}
          </Link>
        ))}
      </div>

      {/* Clinic breakdown + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinic Breakdown Table */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">Clinic Breakdown</h2>
            <Link href="/admin/clinics" className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              Manage <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Card>
            {clinicBreakdown.length === 0 ? (
              <CardContent className="py-10 text-center">
                <Building2 className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
                <p className="text-sm text-neutral-500">No clinic data available</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Staff</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Patients</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {clinicBreakdown.map((clinic) => (
                      <tr key={clinic.clinic_id} className="hover:bg-neutral-50/60 transition-colors">
                        <td className="px-6 py-3.5">
                          <p className="font-medium text-neutral-900 truncate max-w-[180px]">{clinic.clinic_name}</p>
                          {(clinic.city || clinic.state) && (
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {[clinic.city, clinic.state].filter(Boolean).join(", ")}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-center text-neutral-700 font-medium">{clinic.staff_count ?? 0}</td>
                        <td className="px-3 py-3.5 text-center text-neutral-700 font-medium">{clinic.patient_count ?? 0}</td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            clinic.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-neutral-100 text-neutral-500"
                          }`}>
                            {clinic.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Notifications panel */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-xs font-semibold text-white bg-red-500 rounded-full px-1.5 py-0.5">
                  {unreadCount}
                </span>
              )}
            </h2>
          </div>
          <Card>
            <div className="divide-y divide-neutral-100">
              {recentNotifications.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Bell className="h-6 w-6 text-neutral-300 mx-auto mb-2" />
                  <p className="text-xs text-neutral-400">No notifications</p>
                </div>
              ) : (
                recentNotifications.map((n) => (
                  <div key={n.id} className={`px-4 py-3 ${!n.is_read ? "bg-blue-50/40" : ""}`}>
                    <div className="flex items-start gap-2">
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-neutral-800">{n.title}</p>
                        <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{n.message}</p>
                        <p className="text-[10px] text-neutral-400 mt-1">{timeAgo(n.created_at)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
