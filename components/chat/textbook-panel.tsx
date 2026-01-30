"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { BookOpen } from "lucide-react";
import { TextbookCard } from "./textbook-card";

interface TextbookPanelProps {
  onCollapse: () => void;
  onTextbookClick: (id: Id<"textbooks">) => void;
}

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function TextbookPanel({ onCollapse, onTextbookClick }: TextbookPanelProps) {
  const { user } = useUser();
  const t = useTranslations("chat");
  const [grade, setGrade] = useState<number | undefined>(undefined);
  const [subject, setSubject] = useState<string | undefined>(undefined);

  const textbooks = useQuery(api.textbooks.listActive, {
    grade,
    subject,
  });

  // Get unique subjects from results for the filter
  const allTextbooks = useQuery(api.textbooks.listActive, {});
  const subjects = Array.from(
    new Set((allTextbooks || []).map((tb) => tb.subjectName))
  );

  // Recent textbooks
  const recentTextbooks = useQuery(
    api.recentTextbooks.listRecent,
    user?.id ? { clerkUserId: user.id } : "skip"
  );

  return (
    <div className="flex h-full w-72 flex-col rounded-3xl bg-white overflow-hidden">
      {/* Header - pill style */}
      <div className="flex items-center justify-center px-4 py-4">
        <button
          onClick={onCollapse}
          className="flex items-center gap-2 rounded-full border border-purple-200 bg-white px-6 py-3 hover:bg-purple-50 transition-colors"
        >
          <BookOpen className="h-5 w-5 text-purple-500" />
          <span className="text-sm font-medium text-purple-600">
            {t("textbooks")}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b px-4 py-2">
        <select
          value={grade ?? ""}
          onChange={(e) =>
            setGrade(e.target.value ? Number(e.target.value) : undefined)
          }
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none"
        >
          <option value="">{t("allGrades")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {t("gradeLabel", { grade: g })}
            </option>
          ))}
        </select>
        <select
          value={subject ?? ""}
          onChange={(e) =>
            setSubject(e.target.value || undefined)
          }
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none"
        >
          <option value="">{t("allSubjects")}</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Recent textbooks section */}
        {recentTextbooks && recentTextbooks.length > 0 && (
          <div className="mb-4">
            <h4 className="mb-2 text-xs font-semibold text-gray-800">
              {t("recentTextbooks")}
            </h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {recentTextbooks.map((tb) => (
                <div key={tb._id} className="w-24 shrink-0">
                  <TextbookCard
                    subjectName={tb.subjectName}
                    grade={tb.grade}
                    thumbnailUrl={tb.thumbnailUrl}
                    onClick={() => onTextbookClick(tb._id)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All textbooks section */}
        <h4 className="mb-2 text-xs font-semibold text-gray-800">
          {t("allTextbooksList")}
        </h4>

        {!textbooks ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : textbooks.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-gray-400">
            <BookOpen className="h-6 w-6" />
            <p className="text-xs">{t("noTextbooks")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {textbooks.map((tb) => (
              <TextbookCard
                key={tb._id}
                subjectName={tb.subjectName}
                grade={tb.grade}
                thumbnailUrl={tb.thumbnailUrl}
                onClick={() => onTextbookClick(tb._id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
