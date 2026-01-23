"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

interface TextbookCardProps {
  subjectName: string;
  grade: number;
  thumbnailUrl: string | null;
  onClick?: () => void;
}

export function TextbookCard({
  subjectName,
  grade,
  thumbnailUrl,
  onClick,
}: TextbookCardProps) {
  const t = useTranslations("chat");

  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white transition-all hover:scale-[1.02] hover:shadow-md"
    >
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-50">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={subjectName}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <p className="text-xs font-medium text-gray-800 truncate">{subjectName}</p>
        <span className="inline-flex w-fit items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
          {t("gradeLabel", { grade })}
        </span>
      </div>
    </button>
  );
}
