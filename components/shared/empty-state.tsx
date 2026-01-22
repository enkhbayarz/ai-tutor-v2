"use client";

import { Package } from "lucide-react";
import { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
}

export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-xl border">
      <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        {icon || <Package className="w-12 h-12 text-blue-200" />}
      </div>
      <p className="text-gray-500 mb-6">{message}</p>
      {action}
    </div>
  );
}
