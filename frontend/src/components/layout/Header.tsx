"use client";

import { memo } from "react";
import { Menu } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

function HeaderInner() {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-neutral-200/80 flex items-center px-4 gap-3 z-30">
      <button
        className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <span className="text-base font-bold text-neutral-800 tracking-tight">Anava</span>
    </header>
  );
}

export const Header = memo(HeaderInner);
