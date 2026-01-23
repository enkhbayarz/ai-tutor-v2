"use client";

import Image from "next/image";
import { MessageActions } from "./message-actions";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUrl?: string | null;
}

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

function formatContent(content: string) {
  // Simple markdown: bold and line breaks
  return content.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={i}>
        {i > 0 && <br />}
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return <strong key={j}>{part.slice(2, -2)}</strong>;
          }
          return <span key={j}>{part}</span>;
        })}
      </span>
    );
  });
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-slate-800 px-4 py-2 text-white">
          {message.imageUrl && (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="max-h-48 rounded-lg object-contain"
              />
            </div>
          )}
          {message.content && (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50">
        <Image
          src="/logo_ai.png"
          alt="AI"
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
          {formatContent(message.content)}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-gray-400" />
          )}
        </div>
        {!isStreaming && <MessageActions content={message.content} />}
      </div>
    </div>
  );
}
