"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft, BookOpen, ChevronDown } from "lucide-react";
import { TextbookReference } from "./chat-view";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface TextbookDetailPanelProps {
  textbookId: Id<"textbooks">;
  onBack: () => void;
  onSelectTextbook: (id: Id<"textbooks"> | null) => void;
  onSetReference: (ref: TextbookReference) => void;
}

export function TextbookDetailPanel({
  textbookId,
  onBack,
  onSelectTextbook,
  onSetReference,
}: TextbookDetailPanelProps) {
  const { user } = useUser();
  const t = useTranslations("chat");
  const addRecent = useMutation(api.recentTextbooks.addRecent);
  const addedRef = useRef(false);

  const textbook = useQuery(api.textbooks.getById, { id: textbookId });

  // Record view and notify parent on mount
  useEffect(() => {
    if (user?.id && !addedRef.current) {
      addedRef.current = true;
      addRecent({ clerkUserId: user.id, textbookId });
      onSelectTextbook(textbookId);
    }
  }, [user?.id, textbookId, addRecent, onSelectTextbook]);

  const handleBack = () => {
    onSelectTextbook(null);
    onBack();
  };

  if (!textbook) {
    return (
      <div className="flex h-full w-80 flex-col rounded-3xl bg-white overflow-hidden">
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  const chapters = (textbook.tableOfContents || []).sort(
    (a, b) => a.order - b.order
  );

  return (
    <div className="flex h-full w-80 flex-col rounded-3xl bg-white overflow-hidden">
      {/* Back button */}
      <div className="border-b px-4 py-3">
        <button
          onClick={handleBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Cover image */}
        {textbook.thumbnailUrl && (
          <div className="mb-4 flex justify-center">
            <div className="relative h-40 w-28 overflow-hidden rounded-lg border border-gray-100 shadow-sm">
              <Image
                src={textbook.thumbnailUrl}
                alt={textbook.subjectName}
                fill
                className="object-cover"
              />
            </div>
          </div>
        )}

        {/* Title */}
        <h3 className="text-lg font-bold text-gray-900">
          {textbook.subjectName} {textbook.grade}
        </h3>

        {/* Chapter count */}
        <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
          <BookOpen className="h-3.5 w-3.5" />
          <span>{t("chapterLessons", { count: chapters.length })}</span>
        </div>

        {/* Chapters accordion */}
        {chapters.length > 0 && (
          <Accordion
            type="multiple"
            defaultValue={[chapters[0]?.id]}
            className="mt-4 space-y-2"
          >
            {chapters.map((chapter) => (
              <AccordionItem
                key={chapter.id}
                value={chapter.id}
                className="border rounded-lg overflow-hidden"
              >
                <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:hidden">
                  <div className="flex flex-1 items-center justify-between">
                    <div className="flex flex-col items-start text-left">
                      <span className="text-[11px] text-gray-400">
                        {chapter.title}
                      </span>
                      <span className="text-sm font-semibold text-gray-800">
                        {chapter.description}
                      </span>
                    </div>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3 pb-3">
                  <div className="space-y-1">
                    {chapter.topics
                      .sort((a, b) => a.order - b.order)
                      .map((topic, index) => (
                        <div
                          key={topic.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5"
                        >
                          <span className="text-xs text-gray-400 w-5">
                            {index + 1}.
                          </span>
                          <span className="flex-1 text-xs text-gray-700">
                            {topic.title}
                          </span>
                        </div>
                      ))}
                  </div>
                  {/* "How can I help?" - set reference for this chapter */}
                  <button
                    onClick={() => onSetReference({
                      textbookId,
                      subjectName: textbook.subjectName,
                      grade: textbook.grade,
                      chapterTitle: chapter.title,
                      chapterDescription: chapter.description,
                      topics: chapter.topics
                        .sort((a, b) => a.order - b.order)
                        .map((t) => t.title),
                    })}
                    className="mt-3 flex w-full items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 transition-colors hover:bg-blue-100"
                  >
                    <Image
                      src="/logo_ai.png"
                      alt="AI"
                      width={20}
                      height={20}
                    />
                    <span className="text-xs font-medium text-blue-700">
                      {t("howCanIHelp")}
                    </span>
                  </button>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </div>
  );
}
