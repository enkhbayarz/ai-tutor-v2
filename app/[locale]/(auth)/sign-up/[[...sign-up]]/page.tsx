"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("auth");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      await signUp.create({
        firstName: name,
        emailAddress: email,
        password,
      });

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message || t("signUpError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(`/${locale}`);
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      setError(clerkError.errors?.[0]?.message || t("verifyError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <div className="flex flex-col items-center">
        <Image
          src="/logo_ai.png"
          alt="AI Tutor Logo"
          width={64}
          height={64}
          className="mb-6"
        />

        <h1 className="text-2xl font-bold text-center mb-2">
          {t("verificationTitle")}
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {t("verificationSubtitle", { email })}
        </p>

        <form onSubmit={handleVerify} className="w-full space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="code">{t("verificationCode")}</Label>
            <Input
              id="code"
              type="text"
              placeholder={t("verificationCodePlaceholder")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-widest"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? t("verifying") : t("verify")}
          </Button>
        </form>
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
      <h1 className="text-2xl font-bold text-center mb-2">{t("signUpTitle")}</h1>
      <p className="text-muted-foreground text-center mb-8">
        {t("signUpWelcome")}
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg">
            {error}
          </div>
        )}

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t("name")}</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              type="text"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t("email")}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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

        {/* CAPTCHA container for Clerk bot protection */}
        <div id="clerk-captcha" />

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 cursor-pointer"
          disabled={isLoading}
        >
          {isLoading ? t("signingUp") : t("signUp")}
        </Button>
      </form>

      {/* Sign in link */}
      <p className="mt-6 text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href={`/${locale}/sign-in`} className="text-blue-500 hover:underline">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
