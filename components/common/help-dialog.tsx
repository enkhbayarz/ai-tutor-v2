"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useReverification } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import {
  User,
  Lock,
  Shield,
  Eye,
  EyeOff,
  Monitor,
  Check,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "profile" | "password" | "security";

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const { user: clerkUser } = useUser();
  const t = useTranslations("helpDialog");
  const convexUser = useQuery(api.users.getCurrentUser);
  const updateProfile = useMutation(api.users.updateProfile);

  const [activeTab, setActiveTab] = useState<TabType>("profile");

  // Profile form state
  const [lastName, setLastName] = useState(convexUser?.displayName?.split(" ")[0] || "");
  const [firstName, setFirstName] = useState(convexUser?.displayName?.split(" ")[1] || "");
  const [username, setUsername] = useState(convexUser?.username || "");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [schoolInfo, setSchoolInfo] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);

  // Sessions state - Type inferred from Clerk's getSessions return value
  type ClerkSession = Awaited<ReturnType<NonNullable<typeof clerkUser>["getSessions"]>>[number];
  const [sessions, setSessions] = useState<ClerkSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Fetch sessions when security tab is active
  const fetchSessions = useCallback(async () => {
    if (!clerkUser) return;

    setSessionsLoading(true);
    try {
      const userSessions = await clerkUser.getSessions();
      setSessions(userSessions || []);
    } catch (error) {
      console.error("Failed to fetch sessions", error);
    } finally {
      setSessionsLoading(false);
    }
  }, [clerkUser]);

  useEffect(() => {
    if (activeTab === "security" && clerkUser) {
      fetchSessions();
    }
  }, [activeTab, clerkUser, fetchSessions]);

  // Password validation
  const passwordChecks = {
    length: newPassword.length >= 8 && newPassword.length <= 32,
    lowercase: /[a-z]/.test(newPassword),
    uppercase: /[A-Z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[!@#$%^&*]/.test(newPassword),
  };

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSaveProfile = async () => {
    setIsProfileLoading(true);
    try {
      const displayName = `${lastName} ${firstName}`.trim();
      await updateProfile({ displayName, username });
      toast.success(t("profileSuccess"));
    } catch {
      toast.error(t("error"));
    } finally {
      setIsProfileLoading(false);
    }
  };

  // Wrap password update with reverification - Clerk will show modal if needed
  const updatePasswordWithReverification = useReverification(
    async () => {
      await clerkUser?.updatePassword({
        currentPassword,
        newPassword,
      });
      return { success: true };
    }
  );

  const handleChangePassword = async () => {
    if (!isPasswordValid) {
      toast.error(t("passwordInvalid"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    setIsPasswordLoading(true);
    try {
      // Call the reverification-wrapped password update
      const result = await updatePasswordWithReverification();

      if (result?.success) {
        toast.success(t("passwordSuccess"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: unknown) {
      // Handle specific Clerk errors
      const clerkError = error as { errors?: Array<{ code?: string; message?: string }> };
      const errorCode = clerkError?.errors?.[0]?.code;

      if (errorCode === "form_password_incorrect") {
        toast.error(t("passwordIncorrect"));
      } else if (errorCode === "form_identifier_not_found" || errorCode === "strategy_for_user_invalid") {
        // User signed up with OAuth and doesn't have a password
        toast.error(t("passwordNotSet"));
      } else if (errorCode === "session_reverification_required") {
        // User cancelled the reverification modal - don't show error
        return;
      } else {
        toast.error(t("passwordError"));
      }
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const tabs = [
    { id: "profile" as TabType, label: t("tabs.profile"), icon: User },
    { id: "password" as TabType, label: t("tabs.password"), icon: Lock },
    { id: "security" as TabType, label: t("tabs.security"), icon: Shield },
  ];

  // Helper to format session info
  const getSessionInfo = (session: ClerkSession) => {
    const activity = session.latestActivity;
    const device = activity?.deviceType || "Unknown Device";
    const browser = activity?.browserName || "";
    const deviceLabel = browser ? `${device} - ${browser}` : device;

    const city = activity?.city || "";
    const country = activity?.country || "";
    const location = [city, country].filter(Boolean).join(", ") || "Unknown Location";

    return { deviceLabel, location };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] p-0 gap-0 [&>button[data-slot=dialog-close]]:hidden">
        <VisuallyHidden>
          <DialogTitle>{t("tabs.profile")}</DialogTitle>
        </VisuallyHidden>
        <div className="flex min-h-[500px]">
          {/* Sidebar */}
          <div className="w-[200px] border-r p-4">
            <button
              onClick={() => onOpenChange(false)}
              className="mb-4 p-1 hover:bg-gray-100 rounded cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer",
                      activeTab === tab.id
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6">
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">{t("profile.title")}</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-600">{t("profile.lastName")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-[200px] text-right border-0 bg-transparent focus-visible:ring-0 px-0"
                      />
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-600">{t("profile.firstName")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-[200px] text-right border-0 bg-transparent focus-visible:ring-0 px-0"
                      />
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-600">{t("profile.username")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-[200px] text-right border-0 bg-transparent focus-visible:ring-0 px-0"
                      />
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-600">{t("profile.phone1")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={phone1}
                        onChange={(e) => setPhone1(e.target.value)}
                        className="w-[200px] text-right border-0 bg-transparent focus-visible:ring-0 px-0"
                        placeholder="99102233"
                      />
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-600">{t("profile.phone2")}</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={phone2}
                        onChange={(e) => setPhone2(e.target.value)}
                        className="w-[200px] text-right border-0 bg-transparent focus-visible:ring-0 px-0"
                        placeholder="99334454"
                      />
                      <button className="text-gray-400 hover:text-gray-600 cursor-pointer">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-600">{t("profile.schoolInfo")}</Label>
                    <Textarea
                      value={schoolInfo}
                      onChange={(e) => setSchoolInfo(e.target.value)}
                      placeholder={t("profile.schoolInfoPlaceholder")}
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={isProfileLoading}
                    variant="outline"
                  >
                    {isProfileLoading ? t("saving") : t("save")}
                  </Button>
                </div>
              </div>
            )}

            {/* Password Tab */}
            {activeTab === "password" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">{t("password.title")}</h2>

                {/* Show message if user doesn't have password (OAuth login) */}
                {!clerkUser?.passwordEnabled ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-800">{t("passwordNotSet")}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="relative">
                        <Input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder={t("password.current")}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={t("password.new")}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      {/* Password requirements */}
                      <div className="space-y-2 text-sm">
                        <p className="text-gray-600">{t("password.requirements")}</p>
                        <div className="space-y-1">
                          <PasswordCheck checked={passwordChecks.length} label={t("password.req.length")} />
                          <PasswordCheck checked={passwordChecks.lowercase} label={t("password.req.lowercase")} />
                          <PasswordCheck checked={passwordChecks.uppercase} label={t("password.req.uppercase")} />
                          <PasswordCheck checked={passwordChecks.number} label={t("password.req.number")} />
                          <PasswordCheck checked={passwordChecks.special} label={t("password.req.special")} />
                        </div>
                      </div>

                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={t("password.confirm")}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={handleChangePassword}
                        disabled={isPasswordLoading || !isPasswordValid}
                        variant="outline"
                      >
                        {isPasswordLoading ? t("saving") : t("save")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold">{t("security.title")}</h2>

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium">{t("security.recentLogins")}</h3>
                    <p className="text-sm text-gray-500">
                      {t("security.recentLoginsDesc")}{" "}
                      <span className="text-blue-600">{clerkUser?.primaryEmailAddress?.emailAddress}</span>{" "}
                      {t("security.recentLoginsDesc2")}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {sessionsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-gray-500">{t("security.loading")}</span>
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {t("security.noSessions")}
                      </div>
                    ) : (
                      sessions.map((session) => {
                        const { deviceLabel, location } = getSessionInfo(session);
                        const isActive = session.status === "active";
                        const lastActive = new Date(session.lastActiveAt).toLocaleString();

                        return (
                          <div
                            key={session.id}
                            className="flex items-start gap-3 p-3 border rounded-lg"
                          >
                            <Monitor className="w-5 h-5 text-gray-400 mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{deviceLabel}</span>
                                {isActive && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>
                                    {t("security.active")}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-500">
                                {location} • {lastActive}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordCheck({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <div className="w-4 h-4 rounded-full border border-gray-300" />
      )}
      <span className={checked ? "text-gray-700" : "text-gray-500"}>{label}</span>
    </div>
  );
}
