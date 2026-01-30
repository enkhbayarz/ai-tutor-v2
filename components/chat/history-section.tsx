"use client";

import { useState, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistorySectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function HistorySection({
  title,
  defaultOpen = true,
  children,
}: HistorySectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            !isOpen && "-rotate-90"
          )}
        />
        {title}
      </button>
      {isOpen && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}
