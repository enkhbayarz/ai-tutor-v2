"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Activity,
  MessageSquare,
  Mic,
  FileText,
  Upload,
  Image,
  AlertTriangle,
} from "lucide-react";

const EVENT_TYPE_ICONS: Record<string, typeof MessageSquare> = {
  chat_message: MessageSquare,
  stt_request: Mic,
  pdf_extraction: FileText,
  file_upload: Upload,
  image_analysis: Image,
};

export default function UsagePage() {
  const t = useTranslations("usage");
  const stats = useQuery(api.usageEvents.getUsageStats);
  const anomalies = useQuery(api.usageEvents.checkAnomalies);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="ml-2 text-sm text-gray-500">{t("loading")}</span>
      </div>
    );
  }

  const eventTypeLabels: Record<string, string> = {
    chat_message: t("chatMessages"),
    stt_request: t("sttRequests"),
    pdf_extraction: t("pdfExtractions"),
    file_upload: t("fileUploads"),
    image_analysis: t("imageAnalysis"),
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <span className="text-sm text-gray-500">{t("totalToday")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.totalEventsToday}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-500" />
            <span className="text-sm text-gray-500">{t("totalWeek")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.totalEventsWeek}</p>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            <span className="text-sm text-gray-500">{t("totalAll")}</span>
          </div>
          <p className="mt-2 text-3xl font-bold">{stats.totalEventsAllTime}</p>
        </div>
      </div>

      {/* Event types breakdown */}
      <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
        <h2 className="mb-3 font-semibold">{t("eventTypes")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {Object.entries(stats.typeStats).map(([type, count]) => {
            const Icon = EVENT_TYPE_ICONS[type] || Activity;
            return (
              <div
                key={type}
                className="flex items-center gap-2 rounded-md bg-gray-50 p-3 dark:bg-gray-800"
              >
                <Icon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">
                    {eventTypeLabels[type] || type}
                  </p>
                  <p className="text-lg font-semibold">{count}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Anomalies */}
      {anomalies && anomalies.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            {t("anomalies")}
          </h2>
          <div className="space-y-2">
            {anomalies.map((a) => (
              <div
                key={a.userId}
                className="flex items-center justify-between rounded bg-white p-2 dark:bg-gray-900"
              >
                <span className="text-sm font-mono">{a.userId}</span>
                <span className="text-sm text-red-600 dark:text-red-400">
                  {t("anomalyWarning", { count: a.count })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {anomalies && anomalies.length === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          {t("noAnomalies")}
        </div>
      )}

      {/* User activity table */}
      <div className="rounded-lg border bg-white shadow-sm dark:bg-gray-900">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">{t("userActivity")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:bg-gray-800">
                <th className="px-4 py-2 text-left font-medium text-gray-500">
                  {t("user")}
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  {t("today")}
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  {t("week")}
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  {t("total")}
                </th>
                <th className="px-4 py-2 text-right font-medium text-gray-500">
                  {t("lastActive")}
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.userStats)
                .sort(([, a], [, b]) => b.today - a.today)
                .map(([userId, userStat]) => (
                  <tr
                    key={userId}
                    className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-2 font-mono text-xs">
                      {userId.slice(0, 20)}...
                    </td>
                    <td className="px-4 py-2 text-right">{userStat.today}</td>
                    <td className="px-4 py-2 text-right">{userStat.week}</td>
                    <td className="px-4 py-2 text-right">{userStat.total}</td>
                    <td className="px-4 py-2 text-right text-xs text-gray-500">
                      {new Date(userStat.lastActive).toLocaleString()}
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
