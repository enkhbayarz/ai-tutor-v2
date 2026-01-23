"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GripVertical, X, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TOCChapter } from "./table-of-contents";

interface TopicItem {
  id: string;
  title: string;
  page: number;
}

interface ChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textbookId: Id<"textbooks">;
  chapter: TOCChapter | null;
  chaptersCount: number;
}

export function ChapterDialog({
  open,
  onOpenChange,
  textbookId,
  chapter,
  chaptersCount,
}: ChapterDialogProps) {
  const t = useTranslations("toc");
  const isEditing = chapter !== null;

  const [chapterNumber, setChapterNumber] = useState("1");
  const [description, setDescription] = useState("");
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const saveTOCChapter = useMutation(api.textbooks.saveTOCChapter);

  useEffect(() => {
    if (open) {
      if (isEditing && chapter) {
        const num = chapter.title.replace(/\D/g, "") || "1";
        setChapterNumber(num);
        setDescription(chapter.description);
        setTopics(
          chapter.topics
            .sort((a, b) => a.order - b.order)
            .map((t) => ({ id: t.id, title: t.title, page: t.page }))
        );
      } else {
        setChapterNumber(String(chaptersCount + 1));
        setDescription("");
        setTopics([]);
      }
    }
  }, [open, chapter, isEditing, chaptersCount]);

  const handleAddTopic = () => {
    setTopics([
      ...topics,
      { id: crypto.randomUUID(), title: "", page: 1 },
    ]);
  };

  const handleRemoveTopic = (id: string) => {
    setTopics(topics.filter((t) => t.id !== id));
  };

  const handleTopicChange = (id: string, title: string) => {
    setTopics(topics.map((t) => (t.id === id ? { ...t, title } : t)));
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...topics];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    setTopics(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error(t("validation.requiredFields"));
      return;
    }

    setIsSaving(true);
    try {
      const title = `Бүлэг ${chapterNumber}`;
      const topicsData = topics
        .filter((t) => t.title.trim())
        .map((t, index) => ({
          id: t.id,
          order: index,
          title: t.title.trim(),
          page: t.page,
        }));

      await saveTOCChapter({
        textbookId,
        chapterId: isEditing ? chapter!.id : undefined,
        title,
        description: description.trim(),
        topics: topicsData,
      });

      toast.success(isEditing ? t("chapterUpdated") : t("chapterAdded"));
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving chapter:", error);
      toast.error(t("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const maxChapters = isEditing ? chaptersCount : chaptersCount + 1;
  const chapterOptions = Array.from({ length: Math.max(maxChapters, 10) }, (_, i) =>
    String(i + 1)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editChapter") : t("addChapter")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Chapter number + Description row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("chapterNumber")}</Label>
              <Select value={chapterNumber} onValueChange={setChapterNumber}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {chapterOptions.map((num) => (
                    <SelectItem key={num} value={num}>
                      Бүлэг {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("chapterName")}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("chapterNamePlaceholder")}
              />
            </div>
          </div>

          {/* Topics section */}
          <div className="space-y-3">
            <Label>{t("lessonTopics")}</Label>

            <div className="space-y-2">
              {topics.map((topic, index) => (
                <div
                  key={topic.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                    dragOverIndex === index && dragIndex !== index
                      ? "border-blue-300 bg-blue-50"
                      : "border-gray-200"
                  } ${dragIndex === index ? "opacity-50" : ""}`}
                >
                  <GripVertical className="w-5 h-5 text-gray-300 shrink-0 cursor-grab active:cursor-grabbing" />
                  <Input
                    value={topic.title}
                    onChange={(e) => handleTopicChange(topic.id, e.target.value)}
                    placeholder={`${index + 1}. Сэдвийн нэр`}
                    className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveTopic(topic.id)}
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              className="w-full border-dashed"
              onClick={handleAddTopic}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t("addTopicBtn")}
            </Button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !description.trim()}
            className="bg-blue-500 hover:bg-blue-600 px-8"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
