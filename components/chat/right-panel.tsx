"use client";

import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import { TextbookPanel } from "./textbook-panel";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
}

export function RightPanel({ open, onClose }: RightPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!open) return null;

  if (expanded) {
    return <TextbookPanel onCollapse={() => setExpanded(false)} />;
  }

  // Collapsed icon bar
  return (
    <div className="flex h-full w-12 flex-col items-center gap-2 border-l bg-white py-3">
      <button
        onClick={onClose}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        onClick={() => setExpanded(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500"
      >
        <BookOpen className="h-4 w-4" />
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-500 text-[8px] font-bold text-white">
          +
        </span>
      </button>
    </div>
  );
}
