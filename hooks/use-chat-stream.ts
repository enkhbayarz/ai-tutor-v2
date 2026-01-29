"use client";

import { useState, useCallback, useRef } from "react";

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (
      message: string,
      sessionId?: string,
      classId?: string,
    ): Promise<string> => {
      setIsStreaming(true);
      setStreamingContent("");

      const abortController = new AbortController();
      abortRef.current = abortController;

      let fullContent = "";

      try {
        const response = await fetch("/api/chat-v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            sessionId,
            classId,
          }),
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
    [],
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
