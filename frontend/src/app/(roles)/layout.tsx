"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SocketInit } from "@/components/SocketInit";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { ROUTES } from "@/lib/constants";

function RolesLayoutInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { isAuthenticated, isLoading, isRestoring } = useAuth();
  const router = useRouter();

  const waiting = isRestoring;

  useEffect(() => {
    if (waiting) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [waiting, isAuthenticated, router]);

  // Hold the entire roles shell until session restoration is done
  if (waiting) return <PageLoader />;
  if (!isAuthenticated) return <PageLoader />;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <Header />
      <SocketInit />
      <main
        className={`pt-14 md:pt-6 p-4 sm:p-6 transition-[margin] duration-150 ease-in-out ${
          isCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <RolesLayoutInner>{children}</RolesLayoutInner>
    </SidebarProvider>
  );
}
