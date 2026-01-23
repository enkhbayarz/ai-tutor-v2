"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

export function ChatWelcome() {
  const t = useTranslations("chat");

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        <Image
          src="/logo_ai.png"
          alt="AI Tutor"
          width={24}
          height={24}
          className="w-6 h-6"
        />
        <span className="text-gray-500 text-lg">{t("greeting")}</span>
      </div>
      <h1 className="text-3xl font-bold text-gray-900">{t("question")}</h1>
    </div>
  );
}
