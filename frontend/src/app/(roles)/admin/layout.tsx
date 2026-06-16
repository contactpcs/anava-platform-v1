"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { USER_ROLES, ROUTES } from "@/lib/constants";

// The parent (roles)/layout.tsx already renders <Sidebar>, <Header>, and <main>.
// This layout only adds the admin-role guard on top of that.

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, isRestoring } = useAuth();
  const router = useRouter();

  const waiting = isRestoring || isLoading;

  const isAdmin = (user?.roles ?? []).some(
    (r) =>
      r === USER_ROLES.PLATFORM_ADMIN ||
      r === USER_ROLES.CLINICAL_ADMIN ||
      String(r).toLowerCase().includes("admin")
  );

  useEffect(() => {
    if (waiting) return; // wait for session restoration before redirecting
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    if (!isAdmin) {
      router.replace(ROUTES.LOGIN);
    }
  }, [waiting, isAuthenticated, isAdmin, router]);

  // Show loader while restoring session or loading auth — never redirect prematurely
  if (waiting) return <PageLoader />;
  if (!isAuthenticated || !isAdmin) return <PageLoader />;

  return <>{children}</>;
}
