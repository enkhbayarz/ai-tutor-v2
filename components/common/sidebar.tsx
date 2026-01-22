"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import {
  Users,
  GraduationCap,
  BookOpen,
  PanelLeft,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileSettingsDialog } from "./profile-settings-dialog";
import { HelpDialog } from "./help-dialog";

export const navItems = [
  { href: "/teacher-info", icon: Users, labelKey: "teachers" },
  { href: "/student-info", icon: GraduationCap, labelKey: "students" },
  { href: "/textbook", icon: BookOpen, labelKey: "textbooks" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const locale = useLocale();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [expanded, setExpanded] = useState(false);
  const [showExpandIcon, setShowExpandIcon] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "hidden lg:flex flex-col min-h-screen bg-white border-r py-4 transition-all duration-300",
          expanded ? "w-64 items-start px-4" : "w-16 items-center"
        )}
      >
        {/* Logo / Expand Button */}
        <div
          className={cn(
            "relative mb-8 flex items-center",
            expanded ? "w-full justify-between" : "justify-center"
          )}
          onMouseEnter={() => setShowExpandIcon(true)}
          onMouseLeave={() => setShowExpandIcon(false)}
        >
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <Image
              src="/logo_ai.png"
              alt="AI Tutor"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            {expanded && (
              <span className="font-semibold text-gray-900">{tCommon("appName")}</span>
            )}
          </Link>

          {/* Expand/Collapse Button */}
          {(showExpandIcon || expanded) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-gray-500 hover:text-gray-700 transition-colors cursor-pointer",
                !expanded && "absolute -right-2 top-1/2 -translate-y-1/2"
              )}
            >
              <PanelLeft className={cn("w-5 h-5", expanded && "rotate-180")} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn("flex-1 flex flex-col gap-2", expanded && "w-full")}>
          {navItems.map((item) => {
            const localizedHref = `/${locale}${item.href}`;
            const isActive = pathname === localizedHref;
            const Icon = item.icon;
            const label = t(item.labelKey);

            const navLink = (
              <Link
                href={localizedHref}
                className={cn(
                  "flex items-center rounded-xl transition-colors cursor-pointer",
                  expanded
                    ? "gap-3 px-4 py-3"
                    : "justify-center w-12 h-12",
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                )}
              >
                <Icon className="w-5 h-5" />
                {expanded && (
                  <span className="font-medium">{label}</span>
                )}
              </Link>
            );

            // Show tooltip only when sidebar is collapsed
            if (!expanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    {navLink}
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    sideOffset={12}
                    className="bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    {label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{navLink}</div>;
          })}
        </nav>

        {/* User Info with Dropdown */}
        <div className={cn("mt-auto pt-4 px-2", expanded && "w-full")}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center cursor-pointer hover:bg-gray-50 rounded-xl p-2 transition-colors",
                  expanded ? "gap-3 w-full" : "justify-center"
                )}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback>
                    {user?.firstName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                {expanded && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.fullName || tCommon("defaultManager")}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user?.primaryEmailAddress?.emailAddress ||
                        tCommon("defaultEmail")}
                    </p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-56 ml-2">
              {/* User Header */}
              <div className="flex items-center gap-3 p-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage
                    src={user?.imageUrl}
                    alt={user?.fullName || "User"}
                  />
                  <AvatarFallback>
                    {user?.firstName?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {user?.fullName || tCommon("defaultManager")}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {user?.primaryEmailAddress?.emailAddress ||
                      tCommon("defaultEmail")}
                  </p>
                </div>
              </div>
              <DropdownMenuSeparator />
              {/* Menu Items */}
              <DropdownMenuItem className="cursor-pointer" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4" />
                {t("settings")}
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer" onClick={() => setHelpOpen(true)}>
                <HelpCircle className="w-4 h-4" />
                {t("help")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <SignOutButton redirectUrl={`/${locale}/sign-in`}>
                <DropdownMenuItem className="cursor-pointer">
                  <LogOut className="w-4 h-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </SignOutButton>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Profile Settings Dialog */}
        <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

        {/* Help Dialog */}
        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      </aside>
    </TooltipProvider>
  );
}
