"use client";

import { useUser } from "@clerk/nextjs";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export function SentryUserProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded) return;

    if (user) {
      // Set user context for Sentry
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
        username: user.username || undefined,
        name: user.fullName || undefined,
      });
    } else {
      // Clear user context on sign out
      Sentry.setUser(null);
    }
  }, [user, isLoaded]);

  return <>{children}</>;
}
