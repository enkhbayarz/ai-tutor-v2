"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  BookOpen,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Flame,
} from "lucide-react";

const MASTERY_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  beginner: "bg-blue-100 text-blue-700",
  intermediate: "bg-yellow-100 text-yellow-700",
  advanced: "bg-green-100 text-green-700",
  mastered: "bg-purple-100 text-purple-700",
};

export default function ProgressPage() {
  const t = useTranslations("progress");
  const progress = useQuery(api.studentProgress.getProgress);
  const weakTopics = useQuery(api.topicMastery.getWeakTopics);
  const allMastery = useQuery(api.topicMastery.getByUser);

  if (progress === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!progress) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-gray-400">
        <BookOpen className="h-12 w-12" />
        <p className="text-lg font-medium">{t("noProgress")}</p>
        <p className="text-sm">{t("startLearning")}</p>
      </div>
    );
  }

  const accuracyPercent = Math.round(progress.averageAccuracy * 100);

  // Group mastery by subject
  const subjectGroups: Record<
    string,
    Array<{
      topicTitle: string;
      masteryLevel: string;
      totalInteractions: number;
      correctAnswers: number;
    }>
  > = {};
  if (allMastery) {
    for (const m of allMastery) {
      if (!subjectGroups[m.subjectName]) {
        subjectGroups[m.subjectName] = [];
      }
      subjectGroups[m.subjectName].push(m);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="h-4 w-4" />
            {t("totalInteractions")}
          </div>
          <p className="mt-1 text-2xl font-bold">{progress.totalInteractions}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Target className="h-4 w-4" />
            {t("accuracy")}
          </div>
          <p className="mt-1 text-2xl font-bold">{accuracyPercent}%</p>
          <div className="mt-1 h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${accuracyPercent}%` }}
            />
          </div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle className="h-4 w-4" />
            {t("topicsMastered")}
          </div>
          <p className="mt-1 text-2xl font-bold">{progress.topicsMastered}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Flame className="h-4 w-4" />
            {t("streak")}
          </div>
          <p className="mt-1 text-2xl font-bold">{progress.currentStreak}</p>
        </div>
      </div>

      {/* Current level */}
      <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
        <span className="text-sm text-gray-500">{t("currentLevel")}</span>
        <p className="mt-1 text-lg font-semibold">
          {t(`levels.${progress.currentLevel}`)}
        </p>
      </div>

      {/* Weak areas */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h2 className="font-semibold">{t("weakAreas")}</h2>
        </div>
        <div className="p-4">
          {!weakTopics || weakTopics.length === 0 ? (
            <p className="text-sm text-gray-400">{t("noWeakAreas")}</p>
          ) : (
            <div className="space-y-2">
              {weakTopics.map((topic) => {
                const accuracy =
                  topic.totalInteractions > 0
                    ? Math.round(
                        (topic.correctAnswers / topic.totalInteractions) * 100
                      )
                    : 0;
                return (
                  <div
                    key={`${topic.subjectName}-${topic.topicTitle}`}
                    className="flex items-center justify-between rounded-md bg-orange-50 px-3 py-2 dark:bg-orange-900/20"
                  >
                    <div>
                      <p className="text-sm font-medium">{topic.topicTitle}</p>
                      <p className="text-xs text-gray-500">
                        {topic.subjectName}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-orange-600">
                      {accuracy}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Subject breakdown */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">{t("subjectBreakdown")}</h2>
        </div>
        <div className="divide-y">
          {Object.entries(subjectGroups).map(([subject, topics]) => (
            <div key={subject} className="p-4">
              <h3 className="mb-2 font-medium text-gray-700 dark:text-gray-300">
                {subject}
              </h3>
              <div className="flex flex-wrap gap-2">
                {topics.map((topic) => (
                  <span
                    key={topic.topicTitle}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${MASTERY_COLORS[topic.masteryLevel]}`}
                  >
                    {topic.topicTitle} -{" "}
                    {t(`mastery.${topic.masteryLevel}`)}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
