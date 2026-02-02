"use client";

import { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, User, Lock, KeyRound, Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");

  // Redirect if already signed in
  useEffect(() => {
    if (authLoaded && isSignedIn) {
      router.push(`/${locale}/chat`);
    }
  }, [authLoaded, isSignedIn, router, locale]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Second factor verification state
  const [needsSecondFactor, setNeedsSecondFactor] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(`/${locale}`);
      } else if (result.status === "needs_second_factor") {
        // Prepare email code verification
        await signIn.prepareSecondFactor({ strategy: "email_code" });
        setNeedsSecondFactor(true);
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string; code?: string }[] };
      const errorMessage = clerkError.errors?.[0]?.message || "";
      const errorCode = clerkError.errors?.[0]?.code || "";

      // If session already exists, redirect to chat
      if (
        errorMessage.toLowerCase().includes("session") ||
        errorCode === "session_exists"
      ) {
        router.push(`/${locale}/chat`);
        return;
      }

      setError(errorMessage || t("signInError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signIn.attemptSecondFactor({
        strategy: "email_code",
        code: verificationCode,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(`/${locale}`);
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message || t("secondFactorError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while checking auth or redirecting
  if (!authLoaded || isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="mt-4 text-sm text-muted-foreground">
          {isSignedIn ? t("redirecting") : t("loading")}
        </p>
      </div>
    );
  }

  // Second factor verification UI
  if (needsSecondFactor) {
    return (
      <div className="flex flex-col items-center">
        {/* Logo */}
        <Image
          src="/logo_ai.png"
          alt="AI Tutor Logo"
          width={64}
          height={64}
          className="mb-6"
        />

        {/* Heading */}
        <h1 className="text-2xl font-bold text-center mb-2">
          {t("secondFactorTitle")}
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {t("secondFactorSubtitle")}
        </p>

        {/* Verification Form */}
        <form onSubmit={handleVerification} className="w-full space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          {/* Verification Code */}
          <div className="space-y-2">
            <Label htmlFor="code">{t("verificationCode")}</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="code"
                type="text"
                placeholder={t("verificationCodePlaceholder")}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                className="pl-10"
                required
                autoComplete="one-time-code"
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? t("verifying") : t("verify")}
          </Button>
        </form>

        {/* Back to sign in */}
        <button
          type="button"
          onClick={() => {
            setNeedsSecondFactor(false);
            setVerificationCode("");
            setError("");
          }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground cursor-pointer"
        >
          {t("backToSignIn")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* Logo */}
      <Image
        src="/logo_ai.png"
        alt="AI Tutor Logo"
        width={64}
        height={64}
        className="mb-6"
      />

      {/* Heading */}
      <h1 className="text-2xl font-bold text-center mb-2">
        {t("welcomeTitle")}
      </h1>
      <p className="text-muted-foreground text-center mb-8">
        {t("welcomeSubtitle")}
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* Email or Username */}
        <div className="space-y-2">
          <Label htmlFor="identifier">{t("identifier")}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="identifier"
              type="text"
              placeholder={t("identifierPlaceholder")}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">{t("password")}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? t("signingIn") : t("signIn")}
        </Button>
      </form>

      {/* Forgot password */}
      <Link
        href={`/${locale}/forgot-password`}
        className="mt-4 text-sm text-muted-foreground hover:text-foreground"
      >
        {t("forgotPassword")}
      </Link>

      {/* Sign up link */}
      <p className="mt-6 text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href={`/${locale}/sign-up`} className="text-blue-500 hover:underline">
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
