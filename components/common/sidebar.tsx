"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Users, GraduationCap, BookOpen } from "lucide-react";
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

  return (
    <aside className="hidden lg:flex flex-col items-center w-16 min-h-screen bg-white border-r py-4">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <Image
          src="/logo_ai.png"
          alt="AI Tutor"
          width={32}
          height={32}
          className="w-8 h-8"
        />
      </Link>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-600"
                  : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </Link>
          );
        })}
      </nav>

      {/* User Avatar */}
      <div className="mt-auto pt-4">
        <Avatar className="w-10 h-10">
          <AvatarImage src={user?.imageUrl} alt={user?.fullName || "User"} />
          <AvatarFallback>
            {user?.firstName?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
      </div>
    </aside>
  );
}
