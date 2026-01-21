import { ClerkProvider } from "@clerk/nextjs";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { locales } from "@/i18n/config";
import { SentryUserProvider } from "@/components/providers/sentry-user-provider";
import {
  PostHogProvider,
  PostHogUserIdentifier,
} from "@/components/providers/posthog-provider";
import { ConvexClientProvider } from "@/components/providers/convex-provider";
import { Toaster } from "@/components/ui/sonner";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <PostHogProvider>
          <NextIntlClientProvider messages={messages}>
            <SentryUserProvider>
              <PostHogUserIdentifier />
              {children}
              <Toaster />
            </SentryUserProvider>
          </NextIntlClientProvider>
        </PostHogProvider>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
