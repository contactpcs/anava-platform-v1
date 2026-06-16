"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { ROUTES } from "@/lib/constants";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { restoreSession } = useAuth();
  const router = useRouter();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Handle 401 responses from the axios interceptor without a full page reload.
  // client.ts dispatches this event instead of setting window.location.href.
  useEffect(() => {
    const handleUnauthorized = () => router.replace(ROUTES.LOGIN);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [router]);

  return <>{children}</>;
}
