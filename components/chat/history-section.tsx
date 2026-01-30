"use client";

import { useState, ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

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
        className="flex items-center justify-between w-full py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="space-y-0.5 mt-1">{children}</div>}
    </div>
  );
}
