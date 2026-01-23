"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations, useLocale } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Pencil,
  FileText,
  BookOpen,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { TableOfContents, TOCChapter } from "@/components/textbook";
import { cn } from "@/lib/utils";

export default function TextbookDetailPage() {
  const t = useTranslations("textbooks");
  const tToc = useTranslations("toc");
  const locale = useLocale();
  const params = useParams();
  const textbookId = params.id as Id<"textbooks">;

  const [isEditingTOC, setIsEditingTOC] = useState(false);
  const [selectedPage, setSelectedPage] = useState<number>(1);

  const textbook = useQuery(api.textbooks.getById, { id: textbookId });

  // Loading state
  if (textbook === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Not found
  if (textbook === null) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">{t("notFound")}</p>
        <Link href={`/${locale}/textbook`}>
          <Button variant="link">{t("backToList")}</Button>
        </Link>
      </div>
    );
  }

  const handleTopicClick = (page: number) => {
    setSelectedPage(page);
  };

  // Cast the chapters to the correct type
  const chapters = (textbook.tableOfContents || []) as TOCChapter[];
  const totalTopics = chapters.reduce((acc, ch) => acc + ch.topics.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/textbook`}>
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {t(`subjects.${textbook.subjectName}`)} {textbook.grade}
            </h1>
            <p className="text-gray-500">
              {textbook.year} • {t(`types.${textbook.type}`)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              textbook.isValid
                ? "bg-green-100 text-green-800 border-green-200"
                : "bg-red-100 text-red-800 border-red-200"
            )}
          >
            {textbook.isValid ? t("valid") : t("invalid")}
          </Badge>
          <Link href={`/${locale}/textbook/${textbookId}/edit`}>
            <Button variant="outline" size="sm" className="rounded-full">
              <Pencil className="w-4 h-4 mr-2" />
              {t("edit")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - TOC */}
        <div className="lg:col-span-1 space-y-4">
          {/* PDF File Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-medium text-sm text-gray-700 mb-3">
              {t("pdfFile")}
            </h3>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {t(`subjects.${textbook.subjectName}`)} {textbook.grade}.pdf
                </p>
                <p className="text-xs text-gray-500">PDF</p>
              </div>
              {textbook.pdfUrl && (
                <a
                  href={textbook.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>

          {/* TOC Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                {tToc("title")}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingTOC(!isEditingTOC)}
                className="text-blue-500 hover:text-blue-600"
              >
                {isEditingTOC ? tToc("done") : tToc("edit")}
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
              <span>
                {chapters.length} {tToc("chapters")}
              </span>
              <span>•</span>
              <span>
                {totalTopics} {tToc("topics")}
              </span>
            </div>

            <TableOfContents
              textbookId={textbookId}
              chapters={chapters}
              isEditing={isEditingTOC}
              onTopicClick={handleTopicClick}
            />
          </div>
        </div>

        {/* Right Panel - PDF Viewer */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-4">
            {textbook.pdfUrl ? (
              <div className="aspect-[3/4] w-full">
                <iframe
                  src={`${textbook.pdfUrl}#page=${selectedPage}`}
                  className="w-full h-full"
                  title="PDF Viewer"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <p className="text-gray-500">{t("noPdf")}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
