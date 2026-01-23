"use client";

import { useTranslations } from "next-intl";
import { Atom, ListChecks, FileText } from "lucide-react";

interface QuickActionButtonsProps {
  onAction: (prompt: string) => void;
}

export function QuickActionButtons({ onAction }: QuickActionButtonsProps) {
  const t = useTranslations("chat");

  const actions = [
    {
      key: "prepareTest",
      icon: Atom,
      iconColor: "text-orange-500",
    },
    {
      key: "lessonPlan",
      icon: ListChecks,
      iconColor: "text-blue-500",
    },
    {
      key: "exercise",
      icon: FileText,
      iconColor: "text-orange-600",
    },
  ] as const;

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto mb-2">
      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={() => onAction(t(action.key))}
          className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <action.icon className={`h-4 w-4 ${action.iconColor}`} />
          {t(action.key)}
        </button>
      ))}
    </div>
  );
}
