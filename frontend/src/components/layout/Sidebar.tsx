"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/hooks";
import { useSidebar } from "@/contexts/SidebarContext";
import { authService } from "@/lib/api/services";
import {
  LayoutDashboard, Users, ClipboardList,
  UserCircle, LogOut, Brain, ChevronLeft, Menu, Calendar, CalendarDays,
  ClipboardCheck, MapPin, Building2, UserCog, Settings,
} from "lucide-react";

const NAV_ITEMS: Record<string, Array<{ label: string; href: string; icon: React.ElementType }>> = {
  patient: [
    { label: "Dashboard",    href: "/patient/dashboard",    icon: LayoutDashboard },
    { label: "Appointments", href: "/patient/appointments", icon: CalendarDays },
    { label: "My Results",   href: "/patient/results",      icon: ClipboardList },
    { label: "Profile",      href: "/patient/profile",      icon: UserCircle },
  ],
  doctor: [
    { label: "Dashboard",    href: "/doctor/dashboard",    icon: LayoutDashboard },
    { label: "Appointments", href: "/doctor/appointments", icon: CalendarDays },
    { label: "Patients",     href: "/doctor/patients",     icon: Users },
    { label: "Schedule",     href: "/doctor/schedule",     icon: Calendar },
    { label: "Profile",      href: "/doctor/profile",      icon: UserCircle },
  ],
  clinical_assistant: [
    { label: "Dashboard",   href: "/clinical-assistant/dashboard",            icon: LayoutDashboard },
    { label: "Appt. Reqs.", href: "/clinical-assistant/appointment-requests", icon: CalendarDays },
    { label: "All Patients",href: "/clinical-assistant/patients",             icon: Users },
    { label: "Approvals",   href: "/clinical-assistant/approvals",            icon: ClipboardCheck },
    { label: "Profile",     href: "/clinical-assistant/profile",              icon: UserCircle },
  ],
  receptionist: [
    { label: "Dashboard",   href: "/receptionist/dashboard",            icon: LayoutDashboard },
    { label: "Appt. Reqs.", href: "/receptionist/appointment-requests", icon: CalendarDays },
    { label: "All Patients",href: "/receptionist/patients",             icon: Users },
    { label: "Approvals",   href: "/receptionist/approvals",            icon: ClipboardCheck },
    { label: "Profile",     href: "/receptionist/profile",              icon: UserCircle },
  ],
  platform_admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Patients",  href: "/admin/patients",  icon: Users },
    { label: "Staff",     href: "/admin/staff",     icon: UserCog },
    { label: "Clinics",   href: "/admin/clinics",   icon: Building2 },
    { label: "Settings",  href: "/admin/settings",  icon: Settings },
  ],
  clinical_admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Patients",  href: "/admin/patients",  icon: Users },
    { label: "Staff",     href: "/admin/staff",     icon: UserCog },
    { label: "Clinics",   href: "/admin/clinics",   icon: Building2 },
    { label: "Settings",  href: "/admin/settings",  icon: Settings },
  ],
};

function SidebarInner() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();
  // On mobile, always show expanded content regardless of isCollapsed state
  const expanded = !isCollapsed || isMobileOpen;
  const [clinicLabel, setClinicLabel] = useState<string | null>(null);

  // Detect admin role first (backend may return "admin", "platform_admin", or "clinical_admin")
  const rawRoles: string[] = user?.roles ?? [];
  const isAdmin = rawRoles.some(
    (r) =>
      r === "platform_admin" ||
      r === "clinical_admin" ||
      String(r).toLowerCase().includes("admin")
  );
  const primaryRole = isAdmin
    ? "platform_admin"
    : String(rawRoles[0] || (user as any)?.role || "patient").toLowerCase();
  const role  = primaryRole;
  const items = NAV_ITEMS[role] || NAV_ITEMS.patient;
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const roleName = isAdmin ? "Admin" : role.replace(/_/g, " ");

  useEffect(() => {
    if (/\/patients\/[^/]+/.test(pathname)) {
      setIsCollapsed(true);
    }
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    const fromUser = (user as any)?.clinic_name || (user as any)?.clinic_city;
    if (fromUser) { setClinicLabel(fromUser); return; }
    const clinicId = (user as any)?.clinic_id;
    if (!clinicId) return;
    authService.getClinics().then((clinics) => {
      const match = clinics.find((c) => c.clinic_id === clinicId);
      setClinicLabel(match?.clinic_name || match?.city || null);
    }).catch(() => {});
  }, [user]);

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    <aside
      className={cn(
        "fixed left-0 top-0 h-full flex flex-col z-40",
        // Desktop: width toggle (no transition to avoid layout thrash)
        isCollapsed ? "md:w-16" : "md:w-64",
        // Mobile: always full width, slide in/out
        "w-64",
        // Transition only the transform, not all properties
        "transition-transform duration-150 ease-in-out",
        isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
      style={{ willChange: "transform", background: "linear-gradient(180deg, #00A1E4 0%, #17749B 100%)" }}
    >
      {/* Logo + toggle */}
      <div className="h-16 border-b border-white/20 flex-shrink-0 flex items-center">
        {expanded ? (
          <div className="flex items-center gap-2 w-full px-4">
            <Link href="/" className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white leading-tight">Anava</p>
                <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest leading-tight">PRS</p>
              </div>
            </Link>
            <button
              onClick={() => isMobileOpen ? setIsMobileOpen(false) : setIsCollapsed(true)}
              className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0 text-white"
              title={isMobileOpen ? "Close menu" : "Collapse sidebar"}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full h-full flex items-center justify-center hover:bg-white/10 transition-colors text-white"
            title="Expand sidebar"
          >
            <Menu className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={!expanded ? item.label : undefined}
              onClick={() => setIsMobileOpen(false)}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors border-l-2",
                expanded ? "gap-3 px-3 py-2.5" : "justify-center px-2 py-2.5",
                isActive
                  ? "bg-white/15 text-white border-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white border-transparent",
              )}
            >
              <item.icon className={cn("h-4.5 w-4.5 flex-shrink-0", isActive ? "text-white" : "text-blue-300")} />
              {expanded && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-white/20 px-2 py-3 flex-shrink-0">
        {expanded ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-blue-300 capitalize leading-tight mt-0.5">{roleName}</p>
              {clinicLabel ? (
                <p className="flex items-center gap-1 text-[10px] text-blue-400 leading-tight mt-0.5">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">{clinicLabel}</span>
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold" title={`${user?.first_name} ${user?.last_name}`}>
              {initials}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title={!expanded ? "Sign out" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white w-full transition-colors",
            expanded ? "gap-3 px-3 py-2" : "justify-center px-2 py-2",
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {expanded && <span>Sign out</span>}
        </button>
      </div>
    </aside>
    </>
  );
}

export const Sidebar = memo(SidebarInner);
