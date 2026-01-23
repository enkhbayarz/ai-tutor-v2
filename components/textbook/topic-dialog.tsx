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
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { TOCTopic } from "./table-of-contents";

interface TopicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textbookId: Id<"textbooks">;
  chapterId: string;
  topic: TOCTopic | null; // null = add mode, object = edit mode
}

export function TopicDialog({
  open,
  onOpenChange,
  textbookId,
  chapterId,
  topic,
}: TopicDialogProps) {
  const t = useTranslations("toc");
  const isEditing = topic !== null;

  const [title, setTitle] = useState("");
  const [page, setPage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const addTopic = useMutation(api.textbooks.addTOCTopic);
  const updateTopic = useMutation(api.textbooks.updateTOCTopic);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(topic?.title || "");
      setPage(topic?.page?.toString() || "");
    }
  }, [open, topic]);

  const handleSubmit = async () => {
    const pageNum = parseInt(page, 10);

    if (!title.trim() || isNaN(pageNum) || pageNum < 1) {
      toast.error(t("validation.requiredFields"));
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && topic) {
        await updateTopic({
          textbookId,
          chapterId,
          topicId: topic.id,
          title: title.trim(),
          page: pageNum,
        });
        toast.success(t("topicUpdated"));
      } else {
        await addTopic({
          textbookId,
          chapterId,
          topic: {
            title: title.trim(),
            page: pageNum,
          },
        });
        toast.success(t("topicAdded"));
      }
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving topic:", error);
      toast.error(t("error"));
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = title.trim() && page && !isNaN(parseInt(page, 10));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editTopic") : t("addTopic")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="topic-title">{t("topicTitle")}</Label>
            <Input
              id="topic-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("topicTitlePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="topic-page">{t("page")}</Label>
            <Input
              id="topic-page"
              type="number"
              min="1"
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSaving || !isValid}
            className="bg-blue-500 hover:bg-blue-600"
          >
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
