import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale } from "./i18n/config";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

const isPublicRoute = createRouteMatcher([
  "/",
  "/:locale",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isProtectedApi = createRouteMatcher([
  "/api/chat(.*)",
  "/api/chimege(.*)",
  "/api/extract-pdf(.*)",
]);

// Routes that should skip locale handling
const isExcludedFromLocale = (pathname: string) => {
  return (
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/ingest") ||
    pathname.startsWith("/_axiom") ||
    pathname.startsWith("/_next")
  );
};

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const pathname = request.nextUrl.pathname;

  // Skip locale middleware for monitoring/api routes
  if (isExcludedFromLocale(pathname)) {
    // Protect API routes that require auth
    if (isProtectedApi(request)) {
      await auth.protect();
    }
    return NextResponse.next();
  }

  // Protect non-public routes BEFORE locale middleware
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  // Run next-intl middleware for locale handling
  return intlMiddleware(request);
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
