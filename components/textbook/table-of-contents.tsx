"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown } from "lucide-react";
import { ChapterDialog } from "./chapter-dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { toast } from "sonner";

export interface TOCTopic {
  id: string;
  order: number;
  title: string;
  page: number;
}

export interface TOCChapter {
  id: string;
  order: number;
  title: string; // "Бүлэг 1", "Бүлэг 2", etc.
  description: string; // Chapter content name
  topics: TOCTopic[];
}

interface TableOfContentsProps {
  textbookId: Id<"textbooks">;
  chapters: TOCChapter[];
  isEditing?: boolean;
  onTopicClick?: (page: number) => void;
}

export function TableOfContents({
  textbookId,
  chapters,
  isEditing = false,
  onTopicClick,
}: TableOfContentsProps) {
  const t = useTranslations("toc");

  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<TOCChapter | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    chapterId: string;
    name: string;
  } | null>(null);

  const deleteChapter = useMutation(api.textbooks.deleteTOCChapter);

  const handleAddChapter = () => {
    setEditingChapter(null);
    setChapterDialogOpen(true);
  };

  const handleEditChapter = (chapter: TOCChapter) => {
    setEditingChapter(chapter);
    setChapterDialogOpen(true);
  };

  const handleDeleteChapter = (chapter: TOCChapter) => {
    setDeleteTarget({
      chapterId: chapter.id,
      name: `${chapter.title}. ${chapter.description}`,
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteChapter({
        textbookId,
        chapterId: deleteTarget.chapterId,
      });
      toast.success(t("chapterDeleted"));
    } catch (error) {
      console.error("Delete error:", error);
      toast.error(t("error"));
      throw error;
    }
  };

  if (chapters.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 mb-4">{t("noChapters")}</p>
        {isEditing && (
          <Button onClick={handleAddChapter} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t("addChapter")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isEditing && (
        <Button
          onClick={handleAddChapter}
          variant="outline"
          className="w-full mb-2"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("addChapter")}
        </Button>
      )}

      <Accordion type="multiple" className="space-y-2">
        {chapters
          .sort((a, b) => a.order - b.order)
          .map((chapter) => (
            <AccordionItem
              key={chapter.id}
              value={chapter.id}
              className="group border rounded-lg overflow-hidden"
            >
              <div className="flex items-center px-4 [&>h3]:flex-1">
                <AccordionTrigger className="flex-1 py-3 cursor-pointer hover:no-underline [&>svg]:hidden">
                  <div className="flex flex-col items-start text-left">
                    <span className="text-xs text-gray-500">
                      {chapter.title}
                    </span>
                    <span className="font-semibold">{chapter.description}</span>
                  </div>
                </AccordionTrigger>

                {/* Buttons visible only when expanded */}
                {isEditing && (
                  <div className="hidden group-data-[state=open]:flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => handleEditChapter(chapter)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" />
                      {t("edit")}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                      onClick={() => handleDeleteChapter(chapter)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Chevron always visible on the far right */}
                <ChevronDown className="ml-3 w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </div>

              <AccordionContent className="px-4 pb-4">
                <div className="space-y-1">
                  {chapter.topics
                    .sort((a, b) => a.order - b.order)
                    .map((topic, index) => (
                      <div
                        key={topic.id}
                        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-gray-50 cursor-pointer"
                        onClick={() => onTopicClick?.(topic.page)}
                      >
                        <span className="text-sm text-gray-400 w-6">
                          {index + 1}.
                        </span>
                        <span className="flex-1 text-sm">{topic.title}</span>
                      </div>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
      </Accordion>

      <ChapterDialog
        open={chapterDialogOpen}
        onOpenChange={setChapterDialogOpen}
        textbookId={textbookId}
        chapter={editingChapter}
        chaptersCount={chapters.length}
      />

      <DeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("deleteChapterTitle")}
        description={t("deleteConfirmation", {
          name: deleteTarget?.name || "",
        })}
        onConfirm={confirmDelete}
        labels={{
          cancel: t("cancel"),
          delete: t("delete"),
          deleting: t("deleting"),
        }}
      />
    </div>
  );
}
