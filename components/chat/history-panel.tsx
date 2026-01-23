"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MessageSquare, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatRelativeDate(
  timestamp: number,
  t: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  if (hours < 24) return t("hoursAgo", { count: hours });
  if (days < 7) return t("daysAgo", { count: days });
  return new Date(timestamp).toLocaleDateString();
}

export function HistoryPanel({ open, onOpenChange }: HistoryPanelProps) {
  const { user } = useUser();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("chat");

  const [deleteId, setDeleteId] = useState<Id<"conversations"> | null>(null);
  const [deleteName, setDeleteName] = useState("");

  const conversations = useQuery(
    api.conversations.list,
    user?.id ? {} : "skip"
  );
  const removeConversation = useMutation(api.conversations.remove);

  const handleClick = (id: Id<"conversations">) => {
    router.push(`/${locale}/chat/c/${id}`);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await removeConversation({ id: deleteId });
    setDeleteId(null);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="text-sm font-medium">
              {t("history")}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {!conversations ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-gray-400">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">{t("noHistory")}</p>
              </div>
            ) : (
              <div className="flex flex-col py-2">
                {conversations.map((conv) => (
                  <div
                    key={conv._id}
                    className="group flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleClick(conv._id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {conv.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">
                          {formatRelativeDate(conv.updatedAt, t)}
                        </span>
                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                          {conv.model === "openai" ? "GPT" : "Gemini"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(conv._id);
                        setDeleteName(conv.title);
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteChat")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteChatConfirm", { name: deleteName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              {t("deleteChat")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
