"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CalendarDays, ClipboardList, UserCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useSidebar } from "@/contexts/SidebarContext";

const TABS = [
  { label: "Home",         href: "/patient/dashboard",    icon: LayoutDashboard },
  { label: "Appointments", href: "/patient/appointments", icon: CalendarDays },
  { label: "Results",      href: "/patient/results",      icon: ClipboardList },
  { label: "Profile",      href: "/patient/profile",      icon: UserCircle },
];

export function PatientBottomNav() {
  const pathname = usePathname();
  const { isMobileOpen } = useSidebar();

  if (isMobileOpen) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 flex items-center"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {TABS.map(({ label, href, icon: Icon }) => {
        const isActive = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 text-[10px] font-medium transition-colors",
              isActive ? "text-blue-600" : "text-neutral-400",
            )}
          >
            <Icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-neutral-400")} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
