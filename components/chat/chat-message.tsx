"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
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

/**
 * Pre-process content to normalize math delimiters for remark-math
 * Converts various LaTeX formats to standard $...$ and $$...$$
 */
function preprocessMath(content: string): string {
  let processed = content;

  // Convert \[...\] to $$...$$ (display math)
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, "\n$$\n$1\n$$\n");

  // Convert \(...\) to $...$ (inline math)
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, "$$$1$$");

  // Wrap standalone \sqrt[...]{...} commands
  processed = processed.replace(
    /(?<!\$)\\sqrt(\[[^\]]*\])?\{[^}]+\}(?!\$)/g,
    (match) => `$${match}$`
  );

  // Wrap standalone \frac{...}{...} commands
  processed = processed.replace(
    /(?<!\$)\\frac\{[^}]+\}\{[^}]+\}(?!\$)/g,
    (match) => `$${match}$`
  );

  // Wrap expressions with \times, \cdot, \div that aren't already in math mode
  // Match patterns like: 2^3 \times 3^3 or a \times b
  processed = processed.replace(
    /(?<!\$)(\S+\s*\\(?:times|cdot|div)\s*\S+)(?!\$)/g,
    (match) => `$${match}$`
  );

  // Wrap standalone superscript/subscript expressions like 2^3, x_1
  // But only if they contain backslash commands nearby
  processed = processed.replace(
    /(?<!\$)(\d+\^[\d{}]+\s*\\times\s*\d+\^[\d{}]+)(?!\$)/g,
    (match) => `$${match}$`
  );

  return processed;
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

  const processedContent = preprocessMath(message.content);

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
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {processedContent}
          </ReactMarkdown>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-gray-400" />
          )}
        </div>
        {!isStreaming && <MessageActions content={message.content} />}
      </div>
    </div>
  );
}
