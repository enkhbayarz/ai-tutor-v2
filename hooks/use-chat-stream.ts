"use client";

import { useState, useCallback, useRef } from "react";
import { ModelType } from "@/components/chat/chat-input";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (messages: ChatMessage[], model: ModelType, textbookContext?: string): Promise<string> => {
      setIsStreaming(true);
      setStreamingContent("");

      const abortController = new AbortController();
      abortRef.current = abortController;

      let fullContent = "";

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, model, textbookContext }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Chat API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;
          setStreamingContent(fullContent);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          // User cancelled, return what we have
        } else {
          console.error("Stream error:", error);
          throw error;
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }

      return fullContent;
    },
    []
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setStreamingContent("");
    setIsStreaming(false);
  }, []);

  return { sendMessage, isStreaming, streamingContent, cancel, reset };
}
