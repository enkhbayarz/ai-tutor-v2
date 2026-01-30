"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, Paperclip, X } from "lucide-react";
// Model selector imports - commented out
// import { ChevronDown } from "lucide-react";
// import {
//   Popover,
//   PopoverContent,
//   PopoverTrigger,
// } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { VoiceIndicator } from "./voice-indicator";

export type ModelType = "openai" | "gemini";

interface ChatInputProps {
  onSend?: (message: string) => void;
  model: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  imageFile?: File | null;
  onImageChange?: (file: File | null) => void;
}

// Model selector labels - commented out
// const MODEL_LABELS: Record<ModelType, string> = {
//   openai: "GPT",
//   gemini: "Gemini",
// };

export function ChatInput({
  onSend,
  model,
  onModelChange,
  disabled,
  value,
  onValueChange,
  imageFile,
  onImageChange,
}: ChatInputProps) {
  const t = useTranslations("chat");
  const [internalMessage, setInternalMessage] = useState("");
  const message = value !== undefined ? value : internalMessage;
  const setMessage = onValueChange || setInternalMessage;
  // const [modelOpen, setModelOpen] = useState(false); // Model selector - commented out
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleTranscript = useCallback(
    (text: string) => {
      const current = value !== undefined ? value : internalMessage;
      setMessage(current ? current + " " + text : text);
    },
    [value, internalMessage, setMessage],
  );

  const {
    isRecording,
    isProcessing,
    audioLevel,
    hasSpoken,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    startRecording,
    stopRecording,
  } = useVoiceInput(handleTranscript);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imageFile) || disabled) return;
    onSend?.(message.trim());
    setMessage("");
  };

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      alert(t("imageTooLarge"));
      return;
    }

    onImageChange?.(file);

    // Generate preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveImage = () => {
    onImageChange?.(null);
    setImagePreview(null);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Mic selector when multiple devices available */}
      {/* {devices.length > 1 && !isRecording && !isProcessing && (
        <div className="mb-2 flex justify-center">
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Mic ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>
      )} */}

      {/* Voice indicator */}
      {(isRecording || isProcessing) && (
        <div className="mb-2 flex justify-center">
          <VoiceIndicator
            audioLevel={audioLevel}
            hasSpoken={hasSpoken}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {/* Image preview */}
      {imagePreview && imageFile && (
        <div className="mb-2 flex items-start gap-2">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Preview"
              className="h-20 w-20 rounded-lg border border-gray-200 object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-gray-900"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
        {/* Model Selector - commented out
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
        */}

        {/* Paperclip Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isRecording}
        >
          <Paperclip className="h-4 w-4 text-gray-400" />
        </Button>

        {/* Text Input */}
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t("inputPlaceholder")}
          disabled={disabled || isRecording}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 disabled:opacity-50"
        />

        {/* Mic Button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 shrink-0",
            isRecording && "text-red-500 animate-pulse",
          )}
          onClick={handleMicClick}
          disabled={disabled || isProcessing}
        >
          {isRecording ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4 text-gray-400" />
          )}
        </Button>

        {/* Send Button */}
        <Button
          type="submit"
          size="icon"
          disabled={disabled || (!message.trim() && !imageFile) || isRecording}
          className="h-8 w-8 shrink-0 rounded-full bg-blue-500 hover:bg-blue-600 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
