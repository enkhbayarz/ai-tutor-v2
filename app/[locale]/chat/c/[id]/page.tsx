"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import { Id } from "@/convex/_generated/dataModel";

const ChatView = dynamic(
  () => import("@/components/chat/chat-view").then((mod) => mod.ChatView),
  { ssr: false }
);

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return <ChatView conversationId={id as Id<"conversations">} />;
}
