"use client";

import { useTranslations } from "next-intl";
import { Settings2, ListTodo, FileText, GraduationCap, Lightbulb, ClipboardCheck } from "lucide-react";

type UserRole = "admin" | "teacher" | "student" | undefined;

interface WelcomeQuickActionsProps {
  onAction: (prompt: string) => void;
  userRole?: UserRole;
}

// Student-focused learning actions (pink, green, purple)
const STUDENT_ACTIONS = [
  {
    id: "lesson",
    icon: GraduationCap,
    color: "bg-pink-100",
    iconColor: "text-pink-500",
    promptKey: "lessonPrompt",
  },
  {
    id: "example",
    icon: Lightbulb,
    color: "bg-green-100",
    iconColor: "text-green-500",
    promptKey: "examplePrompt",
  },
  {
    id: "practice",
    icon: ClipboardCheck,
    color: "bg-purple-100",
    iconColor: "text-purple-500",
    promptKey: "practicePrompt",
  },
] as const;

// Teacher-focused teaching actions (blue, purple, orange)
const TEACHER_ACTIONS = [
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

export function WelcomeQuickActions({ onAction, userRole }: WelcomeQuickActionsProps) {
  // Determine which actions and translation prefix to use based on role
  const isStudent = userRole === "student";
  const actions = isStudent ? STUDENT_ACTIONS : TEACHER_ACTIONS;
  const translationPrefix = isStudent ? "student" : "teacher";

  const t = useTranslations(`chat.welcomeActions.${translationPrefix}`);

  const handleClick = (action: typeof actions[number]) => {
    // All actions send the prompt directly - AI handles conversationally
    onAction(t(action.promptKey));
  };

  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            onClick={() => handleClick(action)}
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
