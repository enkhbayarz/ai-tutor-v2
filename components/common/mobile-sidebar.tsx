"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useLocale, useTranslations } from "next-intl";
import { X, Settings, HelpCircle, LogOut } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navItems } from "./sidebar";
import { ProfileSettingsDialog } from "./profile-settings-dialog";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const locale = useLocale();
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0 [&>button]:hidden">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="flex flex-row items-center justify-between p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Image
                src="/logo_ai.png"
                alt="AI Tutor"
                width={28}
                height={28}
                className="w-7 h-7"
              />
              <span className="font-semibold text-gray-900">{tCommon("appName")}</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </Button>
          </SheetHeader>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => {
              const localizedHref = `/${locale}${item.href}`;
              const isActive = pathname === localizedHref;
              const Icon = item.icon;
              const label = t(item.labelKey);

              return (
                <Link
                  key={item.href}
                  href={localizedHref}
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer",
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Info with Dropdown */}
          <div className="p-4 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full cursor-pointer hover:bg-gray-50 rounded-xl p-2 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={user?.imageUrl}
                      alt={user?.fullName || "User"}
                    />
                    <AvatarFallback>
                      {user?.firstName?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.fullName || tCommon("defaultManager")}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {user?.primaryEmailAddress?.emailAddress ||
                        tCommon("defaultEmail")}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
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
                <DropdownMenuItem className="cursor-pointer">
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
        </div>
      </SheetContent>

      {/* Profile Settings Dialog */}
      <ProfileSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sheet>
  );
}
