"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Users,
  Target,
  BookOpen,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";

export default function AnalyticsPage() {
  const t = useTranslations("analytics");
  const classProgress = useQuery(api.studentProgress.getClassProgress);
  const studentsBehind = useQuery(api.studentProgress.getStudentsBehind);

  if (classProgress === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="ml-2 text-sm text-gray-500">{t("loading")}</span>
      </div>
    );
  }

  if (!classProgress || classProgress.length === 0) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4 text-gray-400">
        <Users className="h-12 w-12" />
        <p className="text-lg font-medium">{t("noData")}</p>
      </div>
    );
  }

  // Compute class averages
  const totalStudents = classProgress.length;
  const avgAccuracy =
    classProgress.reduce((sum, s) => sum + s.averageAccuracy, 0) /
    totalStudents;
  const totalTopicsCovered = classProgress.reduce(
    (sum, s) => sum + s.topicsMastered,
    0
  );

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            {t("totalStudents")}
          </div>
          <p className="mt-1 text-3xl font-bold">{totalStudents}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Target className="h-4 w-4" />
            {t("averageAccuracy")}
          </div>
          <p className="mt-1 text-3xl font-bold">
            {Math.round(avgAccuracy * 100)}%
          </p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BookOpen className="h-4 w-4" />
            {t("topicsCovered")}
          </div>
          <p className="mt-1 text-3xl font-bold">{totalTopicsCovered}</p>
        </div>
      </div>

      {/* Students behind */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h2 className="font-semibold">{t("studentsBehind")}</h2>
        </div>
        <div className="p-4">
          {!studentsBehind || studentsBehind.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              {t("noStudentsBehind")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800">
                    <th className="px-3 py-2 text-left font-medium text-gray-500">
                      {t("studentName")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      {t("accuracy")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      {t("interactions")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      {t("level")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">
                      {t("lastActive")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {studentsBehind.map((student) => {
                    const isInactive = student.lastActiveAt < sevenDaysAgo;
                    const isLowAccuracy = student.averageAccuracy < 0.5;
                    return (
                      <tr
                        key={student._id}
                        className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <td className="px-3 py-2 font-mono text-xs">
                          {student.clerkUserId.slice(0, 16)}...
                          <div className="mt-0.5 flex gap-1">
                            {isLowAccuracy && (
                              <span className="inline-flex rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">
                                {t("lowAccuracy")}
                              </span>
                            )}
                            {isInactive && (
                              <span className="inline-flex rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] text-yellow-600">
                                {t("inactive")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span
                            className={
                              isLowAccuracy
                                ? "font-medium text-red-600"
                                : ""
                            }
                          >
                            {Math.round(student.averageAccuracy * 100)}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          {student.totalInteractions}
                        </td>
                        <td className="px-3 py-2 text-right capitalize">
                          {student.currentLevel}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-500">
                          {new Date(student.lastActiveAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* All students table */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">{t("classOverview")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  {t("studentName")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {t("accuracy")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {t("interactions")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {t("level")}
                </th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">
                  {t("lastActive")}
                </th>
              </tr>
            </thead>
            <tbody>
              {classProgress
                .sort((a, b) => b.totalInteractions - a.totalInteractions)
                .map((student) => (
                  <tr
                    key={student._id}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {student.clerkUserId.slice(0, 20)}...
                    </td>
                    <td className="px-3 py-2 text-right">
                      {Math.round(student.averageAccuracy * 100)}%
                    </td>
                    <td className="px-3 py-2 text-right">
                      {student.totalInteractions}
                    </td>
                    <td className="px-3 py-2 text-right capitalize">
                      {student.currentLevel}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-gray-500">
                      {new Date(student.lastActiveAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
