"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { RootState } from "@/store/store";
import { useAppDispatch } from "@/store/hooks";
import { login, register, logout, restoreSession, clearError } from "@/store/slices/authSlice";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { LoginCredentials, RegisterData } from "@/types/auth.types";

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isRestoring, error } = useSelector((s: RootState) => s.auth);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    const result = await dispatch(login(credentials));
    if (login.fulfilled.match(result)) {
      const roles = result.payload?.roles || [];

      // Check admin first — backend may return platform_admin, clinical_admin, or "admin"
      const isAdmin = roles.some(
        (r: string) =>
          r === USER_ROLES.PLATFORM_ADMIN ||
          r === USER_ROLES.CLINICAL_ADMIN ||
          String(r).toLowerCase().includes("admin")
      );

      if (isAdmin) {
        router.push(ROUTES.ADMIN_DASHBOARD);
      } else if (roles.includes(USER_ROLES.PATIENT)) {
        router.push(ROUTES.PATIENT_DASHBOARD);
      } else if (roles.includes(USER_ROLES.DOCTOR)) {
        router.push(ROUTES.DOCTOR_DASHBOARD);
      } else if (roles.includes(USER_ROLES.RECEPTIONIST)) {
        router.push(ROUTES.RECEPTIONIST_DASHBOARD);
      } else if (roles.includes(USER_ROLES.CLINICAL_ASSISTANT)) {
        router.push(ROUTES.CA_DASHBOARD);
      } else {
        router.push(ROUTES.CA_DASHBOARD);
      }
    }
    return result;
  }, [dispatch, router]);

  const handleRegister = useCallback(async (data: RegisterData) => {
    return dispatch(register(data));
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push(ROUTES.LOGIN);
  }, [dispatch, router]);

  const restore = useCallback(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return {
    user, isAuthenticated, isLoading, isRestoring, error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    restoreSession: restore,
    clearError: () => dispatch(clearError()),
    hasRole: (role: string) => user?.roles?.includes(role as any) ?? false,
    isDoctor: user?.roles?.includes(USER_ROLES.DOCTOR) ?? false,
    isPatient: user?.roles?.includes(USER_ROLES.PATIENT) ?? false,
    isClinicalAssistant: user?.roles?.includes(USER_ROLES.CLINICAL_ASSISTANT) ?? false,
    isReceptionist: user?.roles?.includes(USER_ROLES.RECEPTIONIST) ?? false,
    isAdmin: (user?.roles ?? []).some(
      (r) =>
        r === USER_ROLES.PLATFORM_ADMIN ||
        r === USER_ROLES.CLINICAL_ADMIN ||
        String(r).toLowerCase().includes("admin")
    ),
  };
}
