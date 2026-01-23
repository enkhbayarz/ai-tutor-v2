"use client";

import dynamic from "next/dynamic";

const ChatView = dynamic(
  () => import("@/components/chat/chat-view").then((mod) => mod.ChatView),
  { ssr: false }
);

export default function ChatPage() {
  return <ChatView />;
}
