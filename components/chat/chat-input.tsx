"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Mic, Send, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type ModelType = "openai" | "gemini";

interface ChatInputProps {
  onSend?: (message: string) => void;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
  onMicClick?: () => void;
}

const MODEL_LABELS: Record<ModelType, string> = {
  openai: "GPT",
  gemini: "Gemini",
};

export function ChatInput({
  onSend,
  model,
  onModelChange,
  disabled,
  onMicClick,
}: ChatInputProps) {
  const t = useTranslations("chat");
  const [message, setMessage] = useState("");
  const [modelOpen, setModelOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || disabled) return;
    onSend?.(message.trim());
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
        {/* Model Selector */}
        <Popover open={modelOpen} onOpenChange={setModelOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors shrink-0"
            >
              {MODEL_LABELS[model]}
              <ChevronDown className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-36 p-1"
            sideOffset={8}
          >
            {(Object.keys(MODEL_LABELS) as ModelType[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  onModelChange(key);
                  setModelOpen(false);
                }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-md transition-colors",
                  model === key
                    ? "bg-blue-50 text-blue-600 font-medium"
                    : "hover:bg-gray-100 text-gray-700"
                )}
              >
                {MODEL_LABELS[key]}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Text Input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
        />

        {/* Mic Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onMicClick}
          disabled={disabled}
        >
          <Mic className="h-4 w-4 text-gray-400" />
        </Button>

        {/* Send Button */}
        <Button
          type="submit"
          size="icon"
          disabled={disabled || !message.trim()}
          className="h-8 w-8 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
