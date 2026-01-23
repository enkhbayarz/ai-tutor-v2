"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, BookOpen, Mic, ChevronRight } from "lucide-react";
import { Id } from "@/convex/_generated/dataModel";
import { TextbookPanel } from "./textbook-panel";
import { TextbookDetailPanel } from "./textbook-detail-panel";

type PanelView = "collapsed" | "quick-action" | "textbook-list" | "textbook-detail";

interface RightPanelProps {
  open: boolean;
  onClose: () => void;
  selectedTextbookId: Id<"textbooks"> | null;
  onSelectTextbook: (id: Id<"textbooks"> | null) => void;
}

export function RightPanel({
  open,
  onClose,
  selectedTextbookId,
  onSelectTextbook,
}: RightPanelProps) {
  const t = useTranslations("chat");
  const [view, setView] = useState<PanelView>("collapsed");
  const [detailId, setDetailId] = useState<Id<"textbooks"> | null>(null);

  if (!open) return null;

  const handleTextbookClick = (id: Id<"textbooks">) => {
    setDetailId(id);
    setView("textbook-detail");
  };

  const handleDetailBack = () => {
    setDetailId(null);
    setView("textbook-list");
  };

  // Collapsed: circle buttons
  if (view === "collapsed") {
    return (
      <div className="flex h-full w-20 flex-col items-center gap-4 border-l bg-white py-4">
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Book circle button */}
        <button
          onClick={() => setView("quick-action")}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-purple-200 bg-purple-50 text-purple-600 transition-colors hover:bg-purple-100"
        >
          <BookOpen className="h-6 w-6" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] text-gray-500">
            +
          </span>
        </button>

        {/* Mic circle button */}
        <button
          onClick={() => setView("quick-action")}
          className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-200 bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
        >
          <Mic className="h-6 w-6" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-[10px] text-gray-500">
            +
          </span>
        </button>
      </div>
    );
  }

  // Quick action: two rows
  if (view === "quick-action") {
    return (
      <div className="flex h-full w-72 flex-col border-l bg-white">
        {/* Header */}
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <button
            onClick={() => setView("collapsed")}
            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 text-gray-500" />
          </button>
          <span className="text-sm font-medium text-gray-800">
            {t("quickAction")}
          </span>
        </div>

        {/* Action rows */}
        <div className="flex flex-col gap-3 p-4">
          <button
            onClick={() => setView("textbook-list")}
            className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white px-4 py-3 transition-colors hover:bg-purple-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100">
              <BookOpen className="h-4 w-4 text-purple-600" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-gray-700">
              {t("textbooks")}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>

          <button
            className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white px-4 py-3 transition-colors hover:bg-blue-50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100">
              <Mic className="h-4 w-4 text-blue-600" />
            </div>
            <span className="flex-1 text-left text-sm font-medium text-gray-700">
              {t("textbooks")}
            </span>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>
    );
  }

  // Textbook list
  if (view === "textbook-list") {
    return (
      <TextbookPanel
        onCollapse={() => setView("collapsed")}
        onTextbookClick={handleTextbookClick}
      />
    );
  }

  // Textbook detail
  if (view === "textbook-detail" && detailId) {
    return (
      <TextbookDetailPanel
        textbookId={detailId}
        onBack={handleDetailBack}
        onSelectTextbook={onSelectTextbook}
      />
    );
  }

  return null;
}
