"use client";

import { ArrowDown } from "lucide-react";

interface ScrollToBottomProps {
  visible: boolean;
  onClick: () => void;
}

export function ScrollToBottom({ visible, onClick }: ScrollToBottomProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-24 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-lg transition-opacity hover:bg-gray-50"
    >
      <ArrowDown className="h-4 w-4 text-gray-600" />
    </button>
  );
}
