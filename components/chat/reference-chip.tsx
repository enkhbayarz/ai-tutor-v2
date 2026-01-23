"use client";

import { BookOpen, X } from "lucide-react";
import { TextbookReference } from "./chat-view";

interface ReferenceChipProps {
  reference: TextbookReference;
  onRemove: () => void;
}

export function ReferenceChip({ reference, onRemove }: ReferenceChipProps) {
  const label = `${reference.subjectName} ${reference.grade} - ${reference.chapterTitle}: ${reference.chapterDescription}`;

  return (
    <div className="flex max-w-2xl mx-auto mb-2">
      <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="truncate text-xs text-gray-700 max-w-[300px]">
          {label}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
