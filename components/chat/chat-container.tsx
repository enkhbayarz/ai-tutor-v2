"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { ChatMessage, Message } from "./chat-message";
import { ScrollToBottom } from "./scroll-to-bottom";

interface ChatContainerProps {
  messages: Message[];
  streamingContent: string;
  isStreaming: boolean;
}

export function ChatContainer({
  messages,
  streamingContent,
  isStreaming,
}: ChatContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const userScrolledUp = useRef(false);

  const isNearBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      userScrolledUp.current = false;
      setShowScrollBtn(false);
    }
  }, []);

  // Handle user scroll
  const handleScroll = useCallback(() => {
    const nearBottom = isNearBottom();
    userScrolledUp.current = !nearBottom;
    setShowScrollBtn(!nearBottom);
  }, [isNearBottom]);

  // Auto-scroll on new content (unless user scrolled up)
  useEffect(() => {
    if (!userScrolledUp.current) {
      const el = scrollRef.current;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [messages, streamingContent]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingContent && (
            <ChatMessage
              message={{
                id: "streaming",
                role: "assistant",
                content: streamingContent,
              }}
              isStreaming
            />
          )}
        </div>
      </div>
      <ScrollToBottom visible={showScrollBtn} onClick={scrollToBottom} />
    </div>
  );
}
