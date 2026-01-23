"use client";

import { useTranslations } from "next-intl";

interface VoiceIndicatorProps {
  audioLevel: number;
  hasSpoken: boolean;
  isProcessing: boolean;
}

export function VoiceIndicator({
  audioLevel,
  hasSpoken,
  isProcessing,
}: VoiceIndicatorProps) {
  const t = useTranslations("chat");

  if (isProcessing) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <span className="text-xs text-gray-600">{t("processing")}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-75"
          style={{ width: `${Math.min(100, audioLevel * 2)}%` }}
        />
      </div>
      <span className="text-xs text-gray-600">
        {hasSpoken ? "..." : t("recording")}
      </span>
    </div>
  );
}
