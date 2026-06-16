"use client";

import {
  Settings, Shield, Bell, Globe, Lock, ChevronRight,
  User, Building2, Database, Key,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface SettingRow {
  label: string;
  description: string;
  value?: string;
  action?: React.ReactNode;
}

function SettingSection({ title, icon: Icon, rows }: { title: string; icon: React.ElementType; rows: SettingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-sm font-semibold text-neutral-800">{title}</h2>
        </div>
      </CardHeader>
      <div className="divide-y divide-neutral-100">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="text-sm font-medium text-neutral-800">{row.label}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{row.description}</p>
            </div>
            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
              {row.value && (
                <span className="text-sm text-neutral-500">{row.value}</span>
              )}
              {row.action ?? (
                <button className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" defaultChecked={defaultChecked} />
      <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
    </label>
  );
}

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const role = user?.roles?.[0] ?? "";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Settings</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Platform configuration and preferences</p>
      </div>

      {/* Account */}
      <SettingSection
        title="Account"
        icon={User}
        rows={[
          {
            label: "Name",
            description: "Your display name across the platform",
            value: `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() || "—",
          },
          {
            label: "Email",
            description: "Admin account email address",
            value: user?.email ?? "—",
          },
          {
            label: "Role",
            description: "Your administrative role",
            value: role.replace(/_/g, " "),
            action: (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 capitalize">
                {role.replace(/_/g, " ")}
              </span>
            ),
          },
        ]}
      />

      {/* Security */}
      <SettingSection
        title="Security"
        icon={Lock}
        rows={[
          {
            label: "Change Password",
            description: "Update your admin account password",
          },
          {
            label: "Two-Factor Authentication",
            description: "Add an extra layer of security to your account",
            action: <Toggle />,
          },
          {
            label: "Session Timeout",
            description: "Automatically log out after inactivity",
            value: "30 minutes",
          },
        ]}
      />

      {/* Notifications */}
      <SettingSection
        title="Notifications"
        icon={Bell}
        rows={[
          {
            label: "New Patient Registrations",
            description: "Get notified when a new patient registers",
            action: <Toggle defaultChecked />,
          },
          {
            label: "Pending Approvals",
            description: "Receive alerts for pending patient approvals",
            action: <Toggle defaultChecked />,
          },
          {
            label: "Staff Changes",
            description: "Notifications when staff accounts are modified",
            action: <Toggle />,
          },
          {
            label: "Clinic Status Changes",
            description: "Alerts when clinic active status changes",
            action: <Toggle />,
          },
        ]}
      />

      {/* Platform */}
      <SettingSection
        title="Platform"
        icon={Globe}
        rows={[
          {
            label: "Default Language",
            description: "Platform display language",
            value: "English",
          },
          {
            label: "Timezone",
            description: "Default timezone for date/time display",
            value: "Asia/Kolkata",
          },
          {
            label: "Date Format",
            description: "How dates are displayed across the platform",
            value: "DD/MM/YYYY",
          },
        ]}
      />

      {/* Data Management */}
      <SettingSection
        title="Data & API"
        icon={Database}
        rows={[
          {
            label: "API Base URL",
            description: "Backend API endpoint",
            value: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1",
          },
          {
            label: "Export Data",
            description: "Download a full export of platform data",
            action: (
              <button className="text-xs font-medium text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200">
                Export
              </button>
            ),
          },
        ]}
      />

      <p className="text-xs text-neutral-400 text-center">
        Anava PRS · Admin Panel · v1.0.0
      </p>
    </div>
  );
}
