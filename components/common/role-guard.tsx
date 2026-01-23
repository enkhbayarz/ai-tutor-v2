"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

type Role = "admin" | "teacher" | "student";

interface RoleGuardProps {
  allowedRoles: Role[];
  children: React.ReactNode;
  fallbackPath?: string;
}

/**
 * Guards content based on user role.
 * Redirects to fallbackPath (default: /chat) if user's role is not allowed.
 */
export function RoleGuard({
  allowedRoles,
  children,
  fallbackPath = "/chat",
}: RoleGuardProps) {
  const router = useRouter();
  const locale = useLocale();
  const currentUser = useQuery(api.users.getCurrentUser);

  useEffect(() => {
    if (currentUser === undefined) return; // Still loading
    if (!currentUser) {
      router.replace(`/${locale}/sign-in`);
      return;
    }
    if (!currentUser.role || !allowedRoles.includes(currentUser.role as Role)) {
      router.replace(`/${locale}${fallbackPath}`);
    }
  }, [currentUser, allowedRoles, fallbackPath, router, locale]);

  // Show nothing while loading or if not authorized
  if (currentUser === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (
    !currentUser ||
    !currentUser.role ||
    !allowedRoles.includes(currentUser.role as Role)
  ) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Shows content only if user has one of the specified roles.
 * Does NOT redirect - just hides content.
 */
export function RoleVisible({
  roles,
  children,
}: {
  roles: Role[];
  children: React.ReactNode;
}) {
  const currentUser = useQuery(api.users.getCurrentUser);

  if (!currentUser?.role || !roles.includes(currentUser.role as Role)) {
    return null;
  }

  return <>{children}</>;
}
