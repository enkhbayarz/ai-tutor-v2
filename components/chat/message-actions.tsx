"use client";

import { useState, useCallback, useRef } from "react";
import { Copy, Check, Volume2, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface MessageActionsProps {
  content: string;
}

export function MessageActions({ content }: MessageActionsProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [content]);

  const handleAudio = useCallback(async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      const response = await fetch("/api/chimege?type=tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content }),
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        setIsPlaying(false);
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = null;
        }
      };

      await audio.play();
    } catch (error) {
      console.error("TTS playback error:", error);
      setIsPlaying(false);
    }
  }, [content, isPlaying]);

  return (
    <div className="mt-1 flex items-center gap-1">
      <button
        onClick={handleCopy}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title={t("copied")}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={handleAudio}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title={t("listen")}
      >
        {isPlaying ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}
