"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="flex lg:hidden items-center gap-3 px-4 py-3 bg-white border-b">
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        className="h-9 w-9"
      >
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex items-center gap-2">
        <Image
          src="/logo_ai.png"
          alt="AI Tutor"
          width={28}
          height={28}
          className="w-7 h-7"
        />
        <span className="font-semibold text-gray-900">AI tutor</span>
      </div>
    </header>
  );
}
