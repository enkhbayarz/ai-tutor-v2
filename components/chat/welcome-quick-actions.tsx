"use client";

import { useTranslations } from "next-intl";
import { Settings2, ListTodo, FileText } from "lucide-react";

interface WelcomeQuickActionsProps {
  onAction: (prompt: string) => void;
}

const QUICK_ACTIONS = [
  {
    id: "test",
    icon: Settings2,
    color: "bg-blue-100",
    iconColor: "text-blue-500",
    promptKey: "testPrompt",
  },
  {
    id: "lesson",
    icon: ListTodo,
    color: "bg-purple-100",
    iconColor: "text-purple-500",
    promptKey: "lessonPrompt",
  },
  {
    id: "exercise",
    icon: FileText,
    color: "bg-orange-100",
    iconColor: "text-orange-500",
    promptKey: "exercisePrompt",
  },
] as const;

export function WelcomeQuickActions({ onAction }: WelcomeQuickActionsProps) {
  const t = useTranslations("chat.welcomeActions");

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => onAction(t(action.promptKey))}
            className="flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${action.color}`}
            >
              <Icon className={`h-6 w-6 ${action.iconColor}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {t(`${action.id}.title`)}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {t(`${action.id}.description`)}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
