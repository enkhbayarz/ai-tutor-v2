"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Users, GraduationCap, BookOpen, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const navItems = [
  { href: "/teacher-info", icon: Users, label: "Багш" },
  { href: "/student-info", icon: GraduationCap, label: "Сурагч" },
  { href: "/textbook", icon: BookOpen, label: "Сурах бичиг" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const [expanded, setExpanded] = useState(false);
  const [showExpandIcon, setShowExpandIcon] = useState(false);

  return (
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
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo_ai.png"
            alt="AI Tutor"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          {expanded && (
            <span className="font-semibold text-gray-900">AI tutor</span>
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
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-xl transition-colors cursor-pointer",
                expanded
                  ? "gap-3 px-4 py-3"
                  : "justify-center w-12 h-12",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
              title={!expanded ? item.label : undefined}
            >
              <Icon className="w-5 h-5" />
              {expanded && (
                <span className="font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Info */}
      <div className={cn("mt-auto pt-4", expanded && "w-full")}>
        <div className={cn("flex items-center", expanded && "gap-3")}>
          <Avatar className="w-10 h-10">
            <AvatarImage src={user?.imageUrl} alt={user?.fullName || "User"} />
            <AvatarFallback>
              {user?.firstName?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          {expanded && (
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">
                {user?.fullName || "Сургалтын менежэр"}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {user?.primaryEmailAddress?.emailAddress || "admin@school.com"}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
